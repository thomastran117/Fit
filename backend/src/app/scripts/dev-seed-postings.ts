import { randomUUID } from "node:crypto";
import { getDatabaseClient } from "@/configuration/resources/database";

interface DevFixturePosting {
  id: string;
  ownerEmail: string;
  status: "draft" | "published" | "paused";
  family: "place" | "equipment" | "vehicle";
  subtype:
    | "entire_place"
    | "private_room"
    | "workspace"
    | "storage_space"
    | "camera"
    | "tool"
    | "audio"
    | "general_equipment"
    | "bike"
    | "car";
  name: string;
  description: string;
  pricingCurrency: string;
  pricing: Record<string, unknown>;
  tags: string[];
  attributes: Record<string, string | number | boolean | string[]>;
  availabilityStatus: "available" | "limited" | "unavailable";
  availabilityNotes?: string | null;
  maxBookingDurationDays?: number | null;
  latitude: number;
  longitude: number;
  city: string;
  region: string;
  country: string;
  postalCode?: string | null;
  photo: {
    id: string;
    blobUrl: string;
    blobName: string;
  };
  availabilityBlocks: Array<{
    id: string;
    startAt: string;
    endAt: string;
    note?: string | null;
  }>;
}

const DEV_FIXTURE_POSTINGS: DevFixturePosting[] = [
  {
    id: "aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
    ownerEmail: "owner1@rentify.local",
    status: "published",
    family: "place",
    subtype: "entire_place",
    name: "Downtown Toronto Loft",
    description: "A bright furnished loft set up for short stays and local photo shoots.",
    pricingCurrency: "CAD",
    pricing: { currency: "CAD", daily: { amount: 180 }, weekly: { amount: 1050 } },
    tags: ["toronto", "loft", "photoshoot"],
    attributes: {
      guest_capacity: 4,
      bedrooms: 1,
      bathrooms: 1,
      property_type: "loft",
      amenities: ["wifi", "kitchen", "workspace"],
      pet_friendly: false,
      parking: true,
    },
    availabilityStatus: "available",
    availabilityNotes: "Flexible weekday availability.",
    maxBookingDurationDays: 14,
    latitude: 43.6532,
    longitude: -79.3832,
    city: "Toronto",
    region: "Ontario",
    country: "Canada",
    postalCode: "M5V1K4",
    photo: {
      id: "bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
      blobUrl: "https://example.com/dev-seed/postings/toronto-loft/main.jpg",
      blobName: "dev-seed/postings/toronto-loft/main.jpg",
    },
    availabilityBlocks: [
      {
        id: "ccccccc1-cccc-cccc-cccc-ccccccccccc1",
        startAt: "2026-06-15T14:00:00.000Z",
        endAt: "2026-06-18T14:00:00.000Z",
        note: "Owner blocked for maintenance.",
      },
    ],
  },
  {
    id: "aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
    ownerEmail: "owner1@rentify.local",
    status: "draft",
    family: "equipment",
    subtype: "camera",
    name: "Sony Mirrorless Creator Kit",
    description: "Mirrorless camera package with two lenses, battery grip, and travel case.",
    pricingCurrency: "CAD",
    pricing: { currency: "CAD", daily: { amount: 65 } },
    tags: ["camera", "video", "creator"],
    attributes: {
      brand: "Sony",
      model: "A7 IV",
      condition: "excellent",
      includes_delivery: false,
      weight_lb: 4.5,
    },
    availabilityStatus: "available",
    availabilityNotes: null,
    maxBookingDurationDays: 7,
    latitude: 43.6532,
    longitude: -79.3832,
    city: "Toronto",
    region: "Ontario",
    country: "Canada",
    postalCode: "M5V1K4",
    photo: {
      id: "bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2",
      blobUrl: "https://example.com/dev-seed/postings/camera-kit/main.jpg",
      blobName: "dev-seed/postings/camera-kit/main.jpg",
    },
    availabilityBlocks: [],
  },
  {
    id: "aaaaaaa5-aaaa-aaaa-aaaa-aaaaaaaaaaa5",
    ownerEmail: "owner1@rentify.local",
    status: "published",
    family: "place",
    subtype: "private_room",
    name: "Annex Guest Room",
    description: "A quiet private room near transit with desk space for short city stays.",
    pricingCurrency: "CAD",
    pricing: { currency: "CAD", daily: { amount: 85 } },
    tags: ["room", "annex", "shortstay"],
    attributes: {
      guest_capacity: 2,
      bedrooms: 1,
      bathrooms: 1,
      property_type: "house",
      amenities: ["wifi", "desk"],
      pet_friendly: false,
      parking: false,
    },
    availabilityStatus: "limited",
    availabilityNotes: "Best for weekday bookings.",
    maxBookingDurationDays: 10,
    latitude: 43.6687,
    longitude: -79.4039,
    city: "Toronto",
    region: "Ontario",
    country: "Canada",
    postalCode: "M5R2M8",
    photo: {
      id: "bbbbbbb5-bbbb-bbbb-bbbb-bbbbbbbbbbb5",
      blobUrl: "https://example.com/dev-seed/postings/annex-room/main.jpg",
      blobName: "dev-seed/postings/annex-room/main.jpg",
    },
    availabilityBlocks: [],
  },
  {
    id: "aaaaaaa6-aaaa-aaaa-aaaa-aaaaaaaaaaa6",
    ownerEmail: "owner1@rentify.local",
    status: "published",
    family: "equipment",
    subtype: "tool",
    name: "Contractor Tool Pack",
    description: "Rotating set of contractor-grade power tools for weekend renovation work.",
    pricingCurrency: "CAD",
    pricing: { currency: "CAD", daily: { amount: 55 }, weekly: { amount: 300 } },
    tags: ["tools", "contractor", "renovation"],
    attributes: {
      brand: "Milwaukee",
      model: "M18 Combo",
      condition: "good",
      power_source: "battery",
      weight_lb: 18,
      includes_delivery: true,
    },
    availabilityStatus: "available",
    availabilityNotes: "Delivery available within Toronto core.",
    maxBookingDurationDays: 12,
    latitude: 43.7001,
    longitude: -79.4163,
    city: "Toronto",
    region: "Ontario",
    country: "Canada",
    postalCode: "M4N2L3",
    photo: {
      id: "bbbbbbb6-bbbb-bbbb-bbbb-bbbbbbbbbbb6",
      blobUrl: "https://example.com/dev-seed/postings/tool-pack/main.jpg",
      blobName: "dev-seed/postings/tool-pack/main.jpg",
    },
    availabilityBlocks: [
      {
        id: "ccccccc6-cccc-cccc-cccc-ccccccccccc6",
        startAt: "2026-07-04T12:00:00.000Z",
        endAt: "2026-07-06T12:00:00.000Z",
        note: "Already reserved for a personal project.",
      },
    ],
  },
  {
    id: "aaaaaaa7-aaaa-aaaa-aaaa-aaaaaaaaaaa7",
    ownerEmail: "owner1@rentify.local",
    status: "paused",
    family: "place",
    subtype: "storage_space",
    name: "Climate-Controlled Storage Bay",
    description: "Small storage bay for seasonal inventory and short term overflow storage.",
    pricingCurrency: "CAD",
    pricing: { currency: "CAD", daily: { amount: 35 }, monthly: { amount: 650 } },
    tags: ["storage", "inventory", "secure"],
    attributes: {
      guest_capacity: 1,
      bedrooms: 0,
      bathrooms: 0,
      property_type: "storage",
      amenities: ["security_camera", "ground_access"],
      pet_friendly: false,
      parking: true,
    },
    availabilityStatus: "unavailable",
    availabilityNotes: "Temporarily paused for facility upgrades.",
    maxBookingDurationDays: 30,
    latitude: 43.7181,
    longitude: -79.5181,
    city: "Toronto",
    region: "Ontario",
    country: "Canada",
    postalCode: "M9R3A4",
    photo: {
      id: "bbbbbbb7-bbbb-bbbb-bbbb-bbbbbbbbbbb7",
      blobUrl: "https://example.com/dev-seed/postings/storage-bay/main.jpg",
      blobName: "dev-seed/postings/storage-bay/main.jpg",
    },
    availabilityBlocks: [],
  },
  {
    id: "aaaaaa11-aaaa-aaaa-aaaa-aaaaaaaaaa11",
    ownerEmail: "owner1@rentify.local",
    status: "published",
    family: "vehicle",
    subtype: "bike",
    name: "Weekend Trail E-Bike",
    description: "Trail-ready e-bike with helmet, repair kit, and phone mount for day trips.",
    pricingCurrency: "CAD",
    pricing: { currency: "CAD", daily: { amount: 58 }, weekly: { amount: 320 } },
    tags: ["bike", "trail", "weekend"],
    attributes: {
      make: "Specialized",
      model: "Turbo Tero",
      year: 2025,
      seats: 1,
      transmission: "multi-speed",
      fuel_type: "electric",
      license_class: "none",
    },
    availabilityStatus: "available",
    availabilityNotes: "Pickup near High Park.",
    maxBookingDurationDays: 6,
    latitude: 43.6465,
    longitude: -79.4637,
    city: "Toronto",
    region: "Ontario",
    country: "Canada",
    postalCode: "M6R2N2",
    photo: {
      id: "bbbbbb11-bbbb-bbbb-bbbb-bbbbbbbbbb11",
      blobUrl: "https://example.com/dev-seed/postings/trail-ebike/main.jpg",
      blobName: "dev-seed/postings/trail-ebike/main.jpg",
    },
    availabilityBlocks: [],
  },
  {
    id: "aaaaaa12-aaaa-aaaa-aaaa-aaaaaaaaaa12",
    ownerEmail: "owner1@rentify.local",
    status: "draft",
    family: "equipment",
    subtype: "audio",
    name: "Live Event PA Rack",
    description: "Portable PA rack with mixer, powered speakers, stands, and cable bundle.",
    pricingCurrency: "CAD",
    pricing: { currency: "CAD", daily: { amount: 110 }, weekend: { amount: 260 } },
    tags: ["audio", "event", "pa"],
    attributes: {
      brand: "Yamaha",
      model: "StagePas Bundle",
      condition: "good",
      power_source: "wall",
      weight_lb: 54,
      includes_delivery: true,
    },
    availabilityStatus: "limited",
    availabilityNotes: "Draft while updating accessory list.",
    maxBookingDurationDays: 4,
    latitude: 43.6619,
    longitude: -79.3957,
    city: "Toronto",
    region: "Ontario",
    country: "Canada",
    postalCode: "M5S2V6",
    photo: {
      id: "bbbbbb12-bbbb-bbbb-bbbb-bbbbbbbbbb12",
      blobUrl: "https://example.com/dev-seed/postings/pa-rack/main.jpg",
      blobName: "dev-seed/postings/pa-rack/main.jpg",
    },
    availabilityBlocks: [],
  },
  {
    id: "aaaaaa13-aaaa-aaaa-aaaa-aaaaaaaaaa13",
    ownerEmail: "owner1@rentify.local",
    status: "published",
    family: "place",
    subtype: "workspace",
    name: "Junction Team Offsite Loft",
    description: "Open loft space for planning sessions, interviews, and creative workshops.",
    pricingCurrency: "CAD",
    pricing: { currency: "CAD", daily: { amount: 145 }, hourly: { amount: 28 } },
    tags: ["workspace", "team", "offsite"],
    attributes: {
      guest_capacity: 12,
      bedrooms: 0,
      bathrooms: 1,
      property_type: "loft",
      amenities: ["wifi", "projector", "whiteboard"],
      pet_friendly: false,
      parking: true,
    },
    availabilityStatus: "available",
    availabilityNotes: "Best suited for weekday offsites.",
    maxBookingDurationDays: 7,
    latitude: 43.6652,
    longitude: -79.4689,
    city: "Toronto",
    region: "Ontario",
    country: "Canada",
    postalCode: "M6P1N4",
    photo: {
      id: "bbbbbb13-bbbb-bbbb-bbbb-bbbbbbbbbb13",
      blobUrl: "https://example.com/dev-seed/postings/junction-offsite-loft/main.jpg",
      blobName: "dev-seed/postings/junction-offsite-loft/main.jpg",
    },
    availabilityBlocks: [
      {
        id: "cccccc13-cccc-cccc-cccc-cccccccccc13",
        startAt: "2026-08-03T13:00:00.000Z",
        endAt: "2026-08-03T23:00:00.000Z",
        note: "Owner workshop day.",
      },
    ],
  },
  {
    id: "aaaaaa14-aaaa-aaaa-aaaa-aaaaaaaaaa14",
    ownerEmail: "owner1@rentify.local",
    status: "published",
    family: "equipment",
    subtype: "general_equipment",
    name: "Market Stall Display Set",
    description: "Folding shelving, branded backdrops, table covers, and lighting for pop-ups.",
    pricingCurrency: "CAD",
    pricing: { currency: "CAD", daily: { amount: 82 }, weekly: { amount: 410 } },
    tags: ["market", "display", "popup"],
    attributes: {
      brand: "FixtureLab",
      model: "Stall Set",
      condition: "excellent",
      power_source: "mixed",
      weight_lb: 36,
      includes_delivery: true,
    },
    availabilityStatus: "limited",
    availabilityNotes: "Can deliver within west Toronto.",
    maxBookingDurationDays: 8,
    latitude: 43.6405,
    longitude: -79.4312,
    city: "Toronto",
    region: "Ontario",
    country: "Canada",
    postalCode: "M6K1X9",
    photo: {
      id: "bbbbbb14-bbbb-bbbb-bbbb-bbbbbbbbbb14",
      blobUrl: "https://example.com/dev-seed/postings/market-display/main.jpg",
      blobName: "dev-seed/postings/market-display/main.jpg",
    },
    availabilityBlocks: [],
  },
  {
    id: "aaaaaa15-aaaa-aaaa-aaaa-aaaaaaaaaa15",
    ownerEmail: "owner1@rentify.local",
    status: "paused",
    family: "vehicle",
    subtype: "car",
    name: "Neighbourhood Cargo Van",
    description: "Compact cargo van for furniture pickups, vendor deliveries, and weekend moves.",
    pricingCurrency: "CAD",
    pricing: { currency: "CAD", daily: { amount: 118 }, weekly: { amount: 640 } },
    tags: ["van", "cargo", "moving"],
    attributes: {
      make: "Ford",
      model: "Transit Connect",
      year: 2021,
      seats: 2,
      transmission: "automatic",
      fuel_type: "gas",
      license_class: "G",
    },
    availabilityStatus: "unavailable",
    availabilityNotes: "Paused for routine maintenance.",
    maxBookingDurationDays: 5,
    latitude: 43.6487,
    longitude: -79.3951,
    city: "Toronto",
    region: "Ontario",
    country: "Canada",
    postalCode: "M5V2B7",
    photo: {
      id: "bbbbbb15-bbbb-bbbb-bbbb-bbbbbbbbbb15",
      blobUrl: "https://example.com/dev-seed/postings/cargo-van/main.jpg",
      blobName: "dev-seed/postings/cargo-van/main.jpg",
    },
    availabilityBlocks: [],
  },
  {
    id: "aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
    ownerEmail: "owner2@rentify.local",
    status: "published",
    family: "place",
    subtype: "workspace",
    name: "Riverside Workshop Studio",
    description: "A rentable workspace for maker sessions, product shoots, and small team planning.",
    pricingCurrency: "CAD",
    pricing: { currency: "CAD", daily: { amount: 120 }, hourly: { amount: 24 } },
    tags: ["workspace", "studio", "maker"],
    attributes: {
      guest_capacity: 10,
      bedrooms: 0,
      bathrooms: 1,
      property_type: "studio",
      amenities: ["wifi", "tables", "power"],
      pet_friendly: false,
      parking: false,
    },
    availabilityStatus: "limited",
    availabilityNotes: "Weekend bookings require approval.",
    maxBookingDurationDays: 10,
    latitude: 45.4215,
    longitude: -75.6972,
    city: "Ottawa",
    region: "Ontario",
    country: "Canada",
    postalCode: "K1P1J1",
    photo: {
      id: "bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3",
      blobUrl: "https://example.com/dev-seed/postings/workshop-studio/main.jpg",
      blobName: "dev-seed/postings/workshop-studio/main.jpg",
    },
    availabilityBlocks: [
      {
        id: "ccccccc3-cccc-cccc-cccc-ccccccccccc3",
        startAt: "2026-06-21T13:00:00.000Z",
        endAt: "2026-06-22T01:00:00.000Z",
        note: "Reserved for owner event setup.",
      },
    ],
  },
  {
    id: "aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaa4",
    ownerEmail: "owner2@rentify.local",
    status: "paused",
    family: "vehicle",
    subtype: "bike",
    name: "City Commuter E-Bike",
    description: "Electric commuter bike with helmet, lock, and rear cargo rack included.",
    pricingCurrency: "CAD",
    pricing: { currency: "CAD", daily: { amount: 45 } },
    tags: ["bike", "ebike", "commuter"],
    attributes: {
      make: "Rad Power",
      model: "RadCity 5",
      year: 2024,
      seats: 1,
      transmission: "single-speed",
      fuel_type: "electric",
      license_class: "none",
    },
    availabilityStatus: "unavailable",
    availabilityNotes: "Paused while battery is serviced.",
    maxBookingDurationDays: 5,
    latitude: 45.4215,
    longitude: -75.6972,
    city: "Ottawa",
    region: "Ontario",
    country: "Canada",
    postalCode: "K1P1J1",
    photo: {
      id: "bbbbbbb4-bbbb-bbbb-bbbb-bbbbbbbbbbb4",
      blobUrl: "https://example.com/dev-seed/postings/ebike/main.jpg",
      blobName: "dev-seed/postings/ebike/main.jpg",
    },
    availabilityBlocks: [],
  },
  {
    id: "aaaaaaa8-aaaa-aaaa-aaaa-aaaaaaaaaaa8",
    ownerEmail: "owner2@rentify.local",
    status: "published",
    family: "vehicle",
    subtype: "car",
    name: "Compact Hybrid Hatchback",
    description: "Fuel-efficient hatchback for weekend escapes and city errands.",
    pricingCurrency: "CAD",
    pricing: { currency: "CAD", daily: { amount: 78 }, weekly: { amount: 430 } },
    tags: ["car", "hybrid", "weekend"],
    attributes: {
      make: "Toyota",
      model: "Prius C",
      year: 2022,
      seats: 5,
      transmission: "automatic",
      fuel_type: "hybrid",
      license_class: "G",
    },
    availabilityStatus: "available",
    availabilityNotes: "Pickup from central Ottawa.",
    maxBookingDurationDays: 8,
    latitude: 45.4305,
    longitude: -75.6894,
    city: "Ottawa",
    region: "Ontario",
    country: "Canada",
    postalCode: "K1N5Y5",
    photo: {
      id: "bbbbbbb8-bbbb-bbbb-bbbb-bbbbbbbbbbb8",
      blobUrl: "https://example.com/dev-seed/postings/hybrid-hatchback/main.jpg",
      blobName: "dev-seed/postings/hybrid-hatchback/main.jpg",
    },
    availabilityBlocks: [],
  },
  {
    id: "aaaaaaa9-aaaa-aaaa-aaaa-aaaaaaaaaaa9",
    ownerEmail: "owner2@rentify.local",
    status: "draft",
    family: "equipment",
    subtype: "audio",
    name: "Podcast Audio Bundle",
    description: "Mobile podcast bundle with mixer, microphones, headphones, and cases.",
    pricingCurrency: "CAD",
    pricing: { currency: "CAD", daily: { amount: 70 } },
    tags: ["audio", "podcast", "recording"],
    attributes: {
      brand: "Rode",
      model: "Caster Bundle",
      condition: "excellent",
      power_source: "wall",
      weight_lb: 12,
      includes_delivery: false,
    },
    availabilityStatus: "available",
    availabilityNotes: null,
    maxBookingDurationDays: 6,
    latitude: 45.4215,
    longitude: -75.6903,
    city: "Ottawa",
    region: "Ontario",
    country: "Canada",
    postalCode: "K1P5G4",
    photo: {
      id: "bbbbbbb9-bbbb-bbbb-bbbb-bbbbbbbbbbb9",
      blobUrl: "https://example.com/dev-seed/postings/podcast-bundle/main.jpg",
      blobName: "dev-seed/postings/podcast-bundle/main.jpg",
    },
    availabilityBlocks: [],
  },
  {
    id: "aaaaaa10-aaaa-aaaa-aaaa-aaaaaaaaaa10",
    ownerEmail: "owner2@rentify.local",
    status: "published",
    family: "equipment",
    subtype: "general_equipment",
    name: "Pop-Up Event Kit",
    description: "Portable event kit with folding tables, tents, signage stands, and lighting.",
    pricingCurrency: "CAD",
    pricing: { currency: "CAD", daily: { amount: 95 }, weekly: { amount: 520 } },
    tags: ["event", "popup", "portable"],
    attributes: {
      brand: "Generic",
      model: "Event Pro",
      condition: "good",
      power_source: "mixed",
      weight_lb: 42,
      includes_delivery: true,
    },
    availabilityStatus: "limited",
    availabilityNotes: "Best booked at least 48 hours ahead.",
    maxBookingDurationDays: 9,
    latitude: 45.4112,
    longitude: -75.6981,
    city: "Ottawa",
    region: "Ontario",
    country: "Canada",
    postalCode: "K1S3W7",
    photo: {
      id: "bbbbbb10-bbbb-bbbb-bbbb-bbbbbbbbbb10",
      blobUrl: "https://example.com/dev-seed/postings/popup-event-kit/main.jpg",
      blobName: "dev-seed/postings/popup-event-kit/main.jpg",
    },
    availabilityBlocks: [
      {
        id: "cccccc10-cccc-cccc-cccc-cccccccccc10",
        startAt: "2026-07-11T12:00:00.000Z",
        endAt: "2026-07-13T12:00:00.000Z",
        note: "Held for a vendor market weekend.",
      },
    ],
  },
  {
    id: "aaaaaa16-aaaa-aaaa-aaaa-aaaaaaaaaa16",
    ownerEmail: "owner2@rentify.local",
    status: "published",
    family: "place",
    subtype: "entire_place",
    name: "Canal View Heritage Flat",
    description: "Historic flat overlooking the canal, suited for quiet stays and content shoots.",
    pricingCurrency: "CAD",
    pricing: { currency: "CAD", daily: { amount: 165 }, weekly: { amount: 960 } },
    tags: ["heritage", "canal", "flat"],
    attributes: {
      guest_capacity: 4,
      bedrooms: 2,
      bathrooms: 1,
      property_type: "flat",
      amenities: ["wifi", "kitchen", "balcony"],
      pet_friendly: false,
      parking: false,
    },
    availabilityStatus: "available",
    availabilityNotes: "Minimum two-night booking.",
    maxBookingDurationDays: 12,
    latitude: 45.4097,
    longitude: -75.6942,
    city: "Ottawa",
    region: "Ontario",
    country: "Canada",
    postalCode: "K1S5H3",
    photo: {
      id: "bbbbbb16-bbbb-bbbb-bbbb-bbbbbbbbbb16",
      blobUrl: "https://example.com/dev-seed/postings/canal-flat/main.jpg",
      blobName: "dev-seed/postings/canal-flat/main.jpg",
    },
    availabilityBlocks: [],
  },
  {
    id: "aaaaaa17-aaaa-aaaa-aaaa-aaaaaaaaaa17",
    ownerEmail: "owner2@rentify.local",
    status: "draft",
    family: "place",
    subtype: "storage_space",
    name: "Retail Overflow Storage Locker",
    description: "Secure storage locker for seasonal inventory, booth kits, and archive bins.",
    pricingCurrency: "CAD",
    pricing: { currency: "CAD", daily: { amount: 28 }, monthly: { amount: 520 } },
    tags: ["storage", "retail", "overflow"],
    attributes: {
      guest_capacity: 1,
      bedrooms: 0,
      bathrooms: 0,
      property_type: "storage",
      amenities: ["security_camera", "loading_dock"],
      pet_friendly: false,
      parking: true,
    },
    availabilityStatus: "available",
    availabilityNotes: "Draft pending updated access instructions.",
    maxBookingDurationDays: 30,
    latitude: 45.4173,
    longitude: -75.6821,
    city: "Ottawa",
    region: "Ontario",
    country: "Canada",
    postalCode: "K1N8Y1",
    photo: {
      id: "bbbbbb17-bbbb-bbbb-bbbb-bbbbbbbbbb17",
      blobUrl: "https://example.com/dev-seed/postings/storage-locker/main.jpg",
      blobName: "dev-seed/postings/storage-locker/main.jpg",
    },
    availabilityBlocks: [],
  },
  {
    id: "aaaaaa18-aaaa-aaaa-aaaa-aaaaaaaaaa18",
    ownerEmail: "owner2@rentify.local",
    status: "published",
    family: "equipment",
    subtype: "camera",
    name: "Documentary Camera Backpack",
    description: "Run-and-gun camera kit with compact lenses, filters, batteries, and support rig.",
    pricingCurrency: "CAD",
    pricing: { currency: "CAD", daily: { amount: 72 }, weekly: { amount: 390 } },
    tags: ["camera", "documentary", "field"],
    attributes: {
      brand: "Canon",
      model: "R6 Mark II",
      condition: "excellent",
      includes_delivery: false,
      weight_lb: 9,
    },
    availabilityStatus: "limited",
    availabilityNotes: "Approve manually for travel shoots.",
    maxBookingDurationDays: 5,
    latitude: 45.4331,
    longitude: -75.6764,
    city: "Ottawa",
    region: "Ontario",
    country: "Canada",
    postalCode: "K1M1M4",
    photo: {
      id: "bbbbbb18-bbbb-bbbb-bbbb-bbbbbbbbbb18",
      blobUrl: "https://example.com/dev-seed/postings/documentary-camera/main.jpg",
      blobName: "dev-seed/postings/documentary-camera/main.jpg",
    },
    availabilityBlocks: [
      {
        id: "cccccc18-cccc-cccc-cccc-cccccccccc18",
        startAt: "2026-08-12T12:00:00.000Z",
        endAt: "2026-08-15T12:00:00.000Z",
        note: "Blocked for owner production use.",
      },
    ],
  },
  {
    id: "aaaaaa19-aaaa-aaaa-aaaa-aaaaaaaaaa19",
    ownerEmail: "owner2@rentify.local",
    status: "paused",
    family: "equipment",
    subtype: "tool",
    name: "Landscaping Weekend Tool Set",
    description: "Tool set for cleanup and light landscaping, including trimmer and blower.",
    pricingCurrency: "CAD",
    pricing: { currency: "CAD", daily: { amount: 62 } },
    tags: ["tools", "landscaping", "yard"],
    attributes: {
      brand: "EGO",
      model: "Yard Combo",
      condition: "good",
      power_source: "battery",
      weight_lb: 22,
      includes_delivery: false,
    },
    availabilityStatus: "unavailable",
    availabilityNotes: "Paused until replacement battery arrives.",
    maxBookingDurationDays: 3,
    latitude: 45.3862,
    longitude: -75.7112,
    city: "Ottawa",
    region: "Ontario",
    country: "Canada",
    postalCode: "K2C0M7",
    photo: {
      id: "bbbbbb19-bbbb-bbbb-bbbb-bbbbbbbbbb19",
      blobUrl: "https://example.com/dev-seed/postings/landscaping-tools/main.jpg",
      blobName: "dev-seed/postings/landscaping-tools/main.jpg",
    },
    availabilityBlocks: [],
  },
  {
    id: "aaaaaa20-aaaa-aaaa-aaaa-aaaaaaaaaa20",
    ownerEmail: "owner2@rentify.local",
    status: "published",
    family: "vehicle",
    subtype: "bike",
    name: "Family Cargo Bike",
    description: "Long-tail cargo bike for school runs, errands, and family outings around the city.",
    pricingCurrency: "CAD",
    pricing: { currency: "CAD", daily: { amount: 52 }, weekly: { amount: 285 } },
    tags: ["bike", "cargo", "family"],
    attributes: {
      make: "Tern",
      model: "GSD",
      year: 2024,
      seats: 2,
      transmission: "multi-speed",
      fuel_type: "electric",
      license_class: "none",
    },
    availabilityStatus: "available",
    availabilityNotes: "Includes child seat accessories on request.",
    maxBookingDurationDays: 6,
    latitude: 45.4248,
    longitude: -75.6959,
    city: "Ottawa",
    region: "Ontario",
    country: "Canada",
    postalCode: "K1R5V9",
    photo: {
      id: "bbbbbb20-bbbb-bbbb-bbbb-bbbbbbbbbb20",
      blobUrl: "https://example.com/dev-seed/postings/family-cargo-bike/main.jpg",
      blobName: "dev-seed/postings/family-cargo-bike/main.jpg",
    },
    availabilityBlocks: [],
  },
];

export async function ensureDevFixturePostings(userIdsByEmail: Map<string, string>): Promise<void> {
  const prisma = getDatabaseClient();

  for (const fixturePosting of DEV_FIXTURE_POSTINGS) {
    const ownerId = userIdsByEmail.get(fixturePosting.ownerEmail);

    if (!ownerId) {
      throw new Error(`Missing fixture owner for posting seed: ${fixturePosting.ownerEmail}`);
    }

    await prisma.$transaction(async (transaction) => {
      const existingPosting = await transaction.posting.findUnique({
        where: {
          id: fixturePosting.id,
        },
        select: {
          createdAt: true,
        },
      });

      const publishedAt =
        fixturePosting.status === "published" ? existingPosting?.createdAt ?? new Date() : null;
      const pausedAt =
        fixturePosting.status === "paused" ? existingPosting?.createdAt ?? new Date() : null;

      await transaction.posting.upsert({
        where: {
          id: fixturePosting.id,
        },
        update: {
          ownerId,
          status: fixturePosting.status,
          family: fixturePosting.family,
          subtype: fixturePosting.subtype,
          name: fixturePosting.name,
          description: fixturePosting.description,
          pricingCurrency: fixturePosting.pricingCurrency,
          pricing: fixturePosting.pricing as never,
          tags: fixturePosting.tags as never,
          attributes: fixturePosting.attributes as never,
          availabilityStatus: fixturePosting.availabilityStatus,
          availabilityNotes: fixturePosting.availabilityNotes ?? null,
          maxBookingDurationDays: fixturePosting.maxBookingDurationDays ?? null,
          latitude: fixturePosting.latitude,
          longitude: fixturePosting.longitude,
          city: fixturePosting.city,
          region: fixturePosting.region,
          country: fixturePosting.country,
          postalCode: fixturePosting.postalCode ?? null,
          publishedAt,
          pausedAt,
          archivedAt: null,
        },
        create: {
          id: fixturePosting.id,
          ownerId,
          status: fixturePosting.status,
          family: fixturePosting.family,
          subtype: fixturePosting.subtype,
          name: fixturePosting.name,
          description: fixturePosting.description,
          pricingCurrency: fixturePosting.pricingCurrency,
          pricing: fixturePosting.pricing as never,
          tags: fixturePosting.tags as never,
          attributes: fixturePosting.attributes as never,
          availabilityStatus: fixturePosting.availabilityStatus,
          availabilityNotes: fixturePosting.availabilityNotes ?? null,
          maxBookingDurationDays: fixturePosting.maxBookingDurationDays ?? null,
          latitude: fixturePosting.latitude,
          longitude: fixturePosting.longitude,
          city: fixturePosting.city,
          region: fixturePosting.region,
          country: fixturePosting.country,
          postalCode: fixturePosting.postalCode ?? null,
          publishedAt,
          pausedAt,
          archivedAt: null,
        },
      });

      await transaction.postingPhoto.deleteMany({
        where: {
          postingId: fixturePosting.id,
        },
      });

      await transaction.postingPhoto.create({
        data: {
          id: fixturePosting.photo.id,
          postingId: fixturePosting.id,
          blobUrl: fixturePosting.photo.blobUrl,
          blobName: fixturePosting.photo.blobName,
          position: 0,
        },
      });

      await transaction.postingAvailabilityBlock.deleteMany({
        where: {
          postingId: fixturePosting.id,
          source: "owner",
        },
      });

      if (fixturePosting.availabilityBlocks.length > 0) {
        await transaction.postingAvailabilityBlock.createMany({
          data: fixturePosting.availabilityBlocks.map((block) => ({
            id: block.id,
            postingId: fixturePosting.id,
            startAt: new Date(block.startAt),
            endAt: new Date(block.endAt),
            note: block.note ?? null,
            source: "owner",
          })),
        });
      }

      await transaction.postingSearchOutbox.deleteMany({
        where: {
          postingId: fixturePosting.id,
          indexedAt: null,
          deadLetteredAt: null,
        },
      });

      await transaction.postingSearchOutbox.create({
        data: {
          id: randomUUID(),
          postingId: fixturePosting.id,
          operation: fixturePosting.status === "published" ? "upsert" : "delete",
          dedupeKey: `dev-seed:${fixturePosting.id}:${Date.now()}`,
        },
      });
    });

    console.info(
      `Ensured dev fixture posting ${fixturePosting.name} for ${fixturePosting.ownerEmail} (${fixturePosting.status}).`,
    );
  }

  await syncOwnerProfilePostingCounts(userIdsByEmail);
  console.info(`Ensured ${DEV_FIXTURE_POSTINGS.length} dev fixture postings.`);
}

async function syncOwnerProfilePostingCounts(userIdsByEmail: Map<string, string>): Promise<void> {
  const prisma = getDatabaseClient();
  const ownerEmails = Array.from(
    new Set(DEV_FIXTURE_POSTINGS.map((posting) => posting.ownerEmail)),
  );

  for (const ownerEmail of ownerEmails) {
    const ownerId = userIdsByEmail.get(ownerEmail);

    if (!ownerId) {
      continue;
    }

    const [rentPostingsCount, availableRentPostingsCount] = await Promise.all([
      prisma.posting.count({
        where: {
          ownerId,
          status: {
            in: ["draft", "published", "paused"],
          },
        },
      }),
      prisma.posting.count({
        where: {
          ownerId,
          status: "published",
          availabilityStatus: {
            in: ["available", "limited"],
          },
        },
      }),
    ]);

    await prisma.profile.update({
      where: {
        userId: ownerId,
      },
      data: {
        rentPostingsCount,
        availableRentPostingsCount,
      },
    });
  }
}
