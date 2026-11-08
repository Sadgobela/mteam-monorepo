import type { DealType, PropertyType } from "./search";

export type Currency = "USD" | "GEL" | "AED";

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
  /** Placeholder gradient until real photos are uploaded. */
  tone: "violet" | "sand" | "steel" | "rose";
  updatedAt: string;
}
