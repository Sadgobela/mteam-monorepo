import { formatPrice, priceUnit } from "./format";
import type { Dict, Locale } from "./i18n";
import { cityAreas, placeLabel, popularCities } from "./places";
import { buildingStatuses, propertyTypes, type DealType } from "./search";

/** The search assistant's questions, in the order it asks them. Each answer adds URL search parameters. */
export const assistantSteps = ["deal", "type", "city", "area", "budget", "rooms", "building", "market"] as const;
export type AssistantStep = (typeof assistantSteps)[number];

export type SearchParams = Record<string, string>;

export interface AssistantChoice {
  label: string;
  params: SearchParams;
}

const assistantDeals = ["sale", "rent", "daily"] as const;

/** Budget bands in dollars per deal: [from, to], where 0 and Infinity leave that end open. */
const budgets: Record<(typeof assistantDeals)[number], [number, number][]> = {
  sale: [[0, 50_000], [50_000, 100_000], [100_000, 150_000], [150_000, 250_000], [250_000, Infinity]],
  rent: [[0, 500], [500, 800], [800, 1200], [1200, Infinity]],
  daily: [[0, 50], [50, 100], [100, Infinity]],
};

const ROOM_CHOICES = [1, 2, 3, 4];

/** Whether a question means anything given the answers so far. */
function applies(step: AssistantStep, params: SearchParams): boolean {
  if (step === "area") return params.city !== undefined && cityAreas(params.city).length > 1;
  if (step === "rooms") return params.type === "apartment" || params.type === "house";
  if (step === "building") return params.type === "apartment";
  return true;
}

/** The next question to ask, or null when every question that applies has an answer. */
export function nextAssistantStep(answered: readonly AssistantStep[], params: SearchParams): AssistantStep | null {
  return assistantSteps.find((step) => !answered.includes(step) && applies(step, params)) ?? null;
}

function budgetLabel([from, to]: [number, number], deal: DealType, t: Dict): string {
  const unit = priceUnit(deal, t);
  const text = from === 0 ? t.assistant.upTo.replace("{price}", formatPrice(to, "USD")) : to === Infinity ? t.assistant.from.replace("{price}", formatPrice(from, "USD")) : `${formatPrice(from, "USD")} – ${formatPrice(to, "USD")}`;
  return unit ? `${text} ${unit}` : text;
}

/** The answers offered to a question. Every question but the first can be skipped with "any", which adds nothing. */
export function assistantChoices(step: AssistantStep, params: SearchParams, t: Dict, locale: Locale): AssistantChoice[] {
  const any = { label: t.assistant.any, params: {} };
  switch (step) {
    case "deal":
      return assistantDeals.map((deal) => ({ label: t.assistant.deals[deal], params: { deal } }));
    case "type":
      return [...propertyTypes.map((type) => ({ label: t.propertyType[type], params: { type } })), any];
    case "city":
      return [...popularCities.map((city) => ({ label: placeLabel(city, locale), params: { city } })), any];
    case "area":
      return [...cityAreas(params.city).map((area) => ({ label: placeLabel(area.name, locale), params: { district: area.districts.join("|") } })), any];
    case "budget": {
      const deal = params.deal as (typeof assistantDeals)[number];
      return [
        ...budgets[deal].map(([from, to]) => ({
          label: budgetLabel([from, to], deal, t),
          params: { ...(from > 0 && { priceMin: String(from) }), ...(to < Infinity && { priceMax: String(to) }) },
        })),
        any,
      ];
    }
    case "rooms":
      return [...ROOM_CHOICES.map((rooms) => ({ label: t.market.rooms.replace("{count}", String(rooms)), params: { rooms: String(rooms) } })), any];
    case "building":
      return [...buildingStatuses.map((status) => ({ label: t.search.building[status], params: { building: status } })), any];
    case "market":
      return [{ label: t.assistant.belowMarket, params: { belowMarket: "1" } }, any];
  }
}
