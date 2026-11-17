import type { SpecName } from "./details";
import type { Currency, DealType, PropertyType, BuildingStatus } from "./search";


export interface Agent {
  id: string;
  name: string;
  branch: string;
  phone: string;
}

export interface Listing {
  id: number;
  deal: DealType;
  type: PropertyType;
  title: string;
  city: string;
  district: string;
  address: string;
  street?: string;
  metro?: string;
  building?: BuildingStatus;
  price: number;
  currency: Currency;
  lat?: number;
  lng?: number;
  /** Area in square metres. */
  area: number;
  rooms: number;
  floor?: number;
  floors?: number;
  specs: Partial<Record<SpecName, string>>;
  features: string[];
  bedrooms?: number;
  ceiling?: number;
  yearBuilt?: number;
  description: string;
  /** The owner's own English and Russian versions, when written. */
  descriptionEn?: string;
  descriptionRu?: string;
  /** Checked on site by an MTeam broker. */
  verified: boolean;
  /** 1 (well below the market) to 5 (well above). Missing while there are too few comparable listings. */
  marketLevel?: number;
  agent?: Agent;
  /** Who checked the listing on site, and when. */
  verification?: { by: string; at: string };
  /** The number to call: the broker's if there is one, otherwise the owner's. */
  contactPhone: string;
  /** The owner chose chat only: the number is never shown or given out. */
  hidePhone?: boolean;
  sellerId: string;
  /** Public photo URLs in display order. */
  images: string[];
  /** Placeholder gradient until real photos are uploaded. */
  tone: "violet" | "sand" | "steel" | "rose";
  updatedAt: string;
}

/** A listing as the app API sends it: without phone numbers, which are given out one at a time and counted. */
export type PublicListing = Omit<Listing, "contactPhone" | "agent"> & { agent?: Omit<Agent, "phone"> };
