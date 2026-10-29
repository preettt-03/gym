// Single source for brand copy and contact details shown across the site.
// Details come from the gym's Google Business listing and Instagram profile.
const ADDRESS = "Kingfitness gym, Dharmat Rd, near Ranjit Hanuman Mandir, Fatehabad Chandrawatiganj, Badodia Panth, Madhya Pradesh 453551";

export const BRAND = {
  name: "King's Fitness",
  shortName: "King's Fitness",
  tagline: "Lift · Love · Repeat",
  description:
    "King's Fitness gym in Fatehabad, Madhya Pradesh — Crossfit, kickboxing, cycling, dance fitness, personal training and nutrition consulting.",
  contact: {
    phone: "+91 75667 78296",
    address: ADDRESS,
    shortAddress: "Dharmat Rd, near Ranjit Hanuman Mandir, Fatehabad, MP 453551",
  },
  // Google only lists the opening time; add closing times here once confirmed.
  hours: [{ days: "Open daily", time: "5:00 AM – 9:00 PM" }],
  rating: { score: "5.0", source: "Google" },
  amenities: ["Shower facility"],
  services: [
    "Crossfit",
    "Kickboxing",
    "Cycling",
    "Dance fitness classes",
    "Adult sports",
    "Nutrition consulting",
    "Personal training",
  ],
  social: {
    instagram: { handle: "@kingfitness005", url: "https://www.instagram.com/kingfitness005/" },
  },
  maps: {
    // Opens the gym's Google listing (reviews, photos, directions).
    listingUrl: "https://share.google/M0pqKUAgctZCMKopE",
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ADDRESS)}`,
    embedUrl: `https://maps.google.com/maps?q=${encodeURIComponent(ADDRESS)}&z=15&output=embed`,
  },
} as const;
