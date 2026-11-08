import type { Currency, DealType, PropertyType } from "./search";


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
  price: number;
  currency: Currency;
  /** Area in square metres. */
  area: number;
  rooms: number;
  floor?: number;
  floors?: number;
  condition?: string;
  description: string;
  /** Checked on site by an mTeam broker. */
  verified: boolean;
  agent?: Agent;
  /** Who checked the listing on site, and when. */
  verification?: { by: string; at: string };
  /** The number to call: the broker's if there is one, otherwise the owner's. */
  contactPhone: string;
  /** Public photo URLs in display order. */
  images: string[];
  /** Placeholder gradient until real photos are uploaded. */
  tone: "violet" | "sand" | "steel" | "rose";
  updatedAt: string;
}
