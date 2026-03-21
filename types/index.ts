import type { Tables } from './database'

// Raw DB row types
type UserRow = Tables<'users'>
type PGListingRow = Tables<'pg_listings'>
type ShortlistRow = Tables<'shortlists'>
type ReviewRow = Tables<'reviews'>
type OwnerSubscriptionRow = Tables<'owner_subscriptions'>

export interface User {
  id: string
  phone?: string | null
  email?: string | null
  name: string | null
  role: 'tenant' | 'owner'
  avatarUrl?: string | null
  city?: string | null
  createdAt: string | null
}

export interface PGListing {
  id: string
  ownerId: string | null
  title: string
  description?: string | null
  rent: number
  deposit?: number | null
  city: string
  locality: string
  address?: string | null
  roomType: 'single' | 'double' | 'triple' | null
  amenities: string[]
  photos: string[]
  lat?: number | null
  lng?: number | null
  availableFrom?: string | null
  isActive: boolean
  createdAt: string | null
}

export interface Shortlist {
  id: string
  tenantId: string | null
  pgId: string | null
  createdAt: string | null
}

export interface Review {
  id: string
  tenantId: string | null
  pgId: string | null
  rating: number | null
  text?: string | null
  createdAt: string | null
}

export interface OwnerSubscription {
  id: string
  ownerId: string | null
  plan: 'basic' | 'pro'
  status: 'active' | 'expired' | 'cancelled'
  startsAt?: string | null
  expiresAt?: string | null
  createdAt: string | null
}

// Mappers: DB row → friendly interface

export function mapUser(row: UserRow): User {
  return {
    id: row.id,
    phone: row.phone,
    email: row.email,
    name: row.name,
    role: row.role as 'tenant' | 'owner',
    avatarUrl: row.avatar_url,
    city: row.city,
    createdAt: row.created_at,
  }
}

export function mapPGListing(row: PGListingRow): PGListing {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    rent: row.rent,
    deposit: row.deposit,
    city: row.city,
    locality: row.locality,
    address: row.address,
    roomType: row.room_type as 'single' | 'double' | 'triple' | null,
    amenities: row.amenities ?? [],
    photos: row.photos ?? [],
    lat: row.lat,
    lng: row.lng,
    availableFrom: row.available_from,
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
  }
}

export function mapShortlist(row: ShortlistRow): Shortlist {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    pgId: row.pg_id,
    createdAt: row.created_at,
  }
}

export function mapReview(row: ReviewRow): Review {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    pgId: row.pg_id,
    rating: row.rating,
    text: row.text,
    createdAt: row.created_at,
  }
}

export function mapOwnerSubscription(row: OwnerSubscriptionRow): OwnerSubscription {
  return {
    id: row.id,
    ownerId: row.owner_id,
    plan: (row.plan ?? 'basic') as 'basic' | 'pro',
    status: (row.status ?? 'active') as 'active' | 'expired' | 'cancelled',
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}
