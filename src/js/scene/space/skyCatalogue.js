/**
 * The real sky, as data.
 *
 * Everything here is J2000: right ascension in decimal hours, declination in
 * decimal degrees. It is the actual sky the Solar System sits inside, so the
 * constellations are in their real places -- Orion really is below the ecliptic
 * with Betelgeuse orange at one shoulder and Rigel blue-white at the opposite
 * knee, the Milky Way really does run through Sagittarius at its brightest, and
 * Andromeda really is a tilted smudge up in the northern sky. None of that is
 * arranged for the composition; it is where those things are.
 *
 * `bv` is the B-V colour index: negative is a hot blue star, around zero is
 * white, and positive runs through yellow to deep orange-red. It is the only
 * number needed to give every star its true colour.
 */

/** North galactic pole and galactic centre, J2000. */
export const GALACTIC = Object.freeze({
  poleRa: 12.8573,
  poleDec: 27.1283,
  centreRa: 17.761122,
  centreDec: -29.007811,
});

/**
 * Every star brighter than about magnitude 2.5.
 *
 * This is the set that makes the sky recognisable. Below 2.5 a star stops
 * being a landmark and starts being part of the field, and the field is
 * generated -- there is no point carrying nine thousand rows to draw what a
 * distribution draws for free.
 */
export const SKY_STARS = Object.freeze([
  { name: "Sirius", ra: 6.7525, dec: -16.7161, mag: -1.46, bv: 0.00 },
  { name: "Canopus", ra: 6.3992, dec: -52.6957, mag: -0.74, bv: 0.15 },
  { name: "Rigil Kentaurus", ra: 14.6601, dec: -60.8340, mag: -0.27, bv: 0.71 },
  { name: "Arcturus", ra: 14.2610, dec: 19.1824, mag: -0.05, bv: 1.23 },
  { name: "Vega", ra: 18.6156, dec: 38.7837, mag: 0.03, bv: 0.00 },
  { name: "Capella", ra: 5.2782, dec: 45.9980, mag: 0.08, bv: 0.80 },
  { name: "Rigel", ra: 5.2423, dec: -8.2016, mag: 0.13, bv: -0.03 },
  { name: "Procyon", ra: 7.6550, dec: 5.2250, mag: 0.34, bv: 0.42 },
  { name: "Achernar", ra: 1.6286, dec: -57.2368, mag: 0.46, bv: -0.16 },
  { name: "Betelgeuse", ra: 5.9195, dec: 7.4071, mag: 0.50, bv: 1.85 },
  { name: "Hadar", ra: 14.0637, dec: -60.3730, mag: 0.61, bv: -0.23 },
  { name: "Altair", ra: 19.8464, dec: 8.8683, mag: 0.76, bv: 0.22 },
  { name: "Acrux", ra: 12.4433, dec: -63.0991, mag: 0.77, bv: -0.24 },
  { name: "Aldebaran", ra: 4.5987, dec: 16.5093, mag: 0.86, bv: 1.54 },
  { name: "Antares", ra: 16.4901, dec: -26.4320, mag: 0.96, bv: 1.83 },
  { name: "Spica", ra: 13.4199, dec: -11.1613, mag: 0.97, bv: -0.23 },
  { name: "Pollux", ra: 7.7553, dec: 28.0262, mag: 1.14, bv: 1.00 },
  { name: "Fomalhaut", ra: 22.9608, dec: -29.6222, mag: 1.16, bv: 0.09 },
  { name: "Deneb", ra: 20.6905, dec: 45.2803, mag: 1.25, bv: 0.09 },
  { name: "Mimosa", ra: 12.7954, dec: -59.6888, mag: 1.25, bv: -0.24 },
  { name: "Regulus", ra: 10.1395, dec: 11.9672, mag: 1.36, bv: -0.09 },
  { name: "Adhara", ra: 6.9771, dec: -28.9721, mag: 1.50, bv: -0.21 },
  { name: "Castor", ra: 7.5766, dec: 31.8883, mag: 1.58, bv: 0.03 },
  { name: "Gacrux", ra: 12.5194, dec: -57.1132, mag: 1.59, bv: 1.60 },
  { name: "Shaula", ra: 17.5601, dec: -37.1038, mag: 1.62, bv: -0.23 },
  { name: "Bellatrix", ra: 5.4189, dec: 6.3497, mag: 1.64, bv: -0.22 },
  { name: "Elnath", ra: 5.4382, dec: 28.6075, mag: 1.65, bv: -0.13 },
  { name: "Miaplacidus", ra: 9.2200, dec: -69.7172, mag: 1.67, bv: 0.07 },
  { name: "Alnilam", ra: 5.6036, dec: -1.2019, mag: 1.69, bv: -0.18 },
  { name: "Alnair", ra: 22.1372, dec: -46.9610, mag: 1.73, bv: -0.07 },
  { name: "Alnitak", ra: 5.6793, dec: -1.9426, mag: 1.74, bv: -0.21 },
  { name: "Regor", ra: 8.1589, dec: -47.3367, mag: 1.75, bv: -0.15 },
  { name: "Alioth", ra: 12.9005, dec: 55.9598, mag: 1.76, bv: -0.02 },
  { name: "Mirfak", ra: 3.4054, dec: 49.8612, mag: 1.79, bv: 0.48 },
  { name: "Kaus Australis", ra: 18.4029, dec: -34.3846, mag: 1.79, bv: -0.03 },
  { name: "Dubhe", ra: 11.0621, dec: 61.7510, mag: 1.81, bv: 1.07 },
  { name: "Wezen", ra: 7.1399, dec: -26.3932, mag: 1.83, bv: 0.67 },
  { name: "Alkaid", ra: 13.7923, dec: 49.3133, mag: 1.85, bv: -0.19 },
  { name: "Sargas", ra: 17.6220, dec: -42.9978, mag: 1.86, bv: 0.40 },
  { name: "Avior", ra: 8.3752, dec: -59.5095, mag: 1.86, bv: 1.28 },
  { name: "Menkalinan", ra: 5.9921, dec: 44.9474, mag: 1.90, bv: 0.08 },
  { name: "Atria", ra: 16.8111, dec: -69.0277, mag: 1.91, bv: 1.44 },
  { name: "Alhena", ra: 6.6285, dec: 16.3993, mag: 1.93, bv: 0.00 },
  { name: "Alsephina", ra: 8.7451, dec: -54.7088, mag: 1.93, bv: 0.04 },
  { name: "Peacock", ra: 20.4275, dec: -56.7351, mag: 1.94, bv: -0.20 },
  { name: "Polaris", ra: 2.5303, dec: 89.2641, mag: 1.97, bv: 0.60 },
  { name: "Mirzam", ra: 6.3783, dec: -17.9559, mag: 1.98, bv: -0.24 },
  { name: "Alphard", ra: 9.4598, dec: -8.6586, mag: 1.99, bv: 1.44 },
  { name: "Hamal", ra: 2.1196, dec: 23.4624, mag: 2.01, bv: 1.15 },
  { name: "Algieba", ra: 10.3329, dec: 19.8415, mag: 2.01, bv: 1.13 },
  { name: "Diphda", ra: 0.7265, dec: -17.9866, mag: 2.04, bv: 1.02 },
  { name: "Nunki", ra: 18.9211, dec: -26.2967, mag: 2.05, bv: -0.13 },
  { name: "Menkent", ra: 14.1114, dec: -36.3700, mag: 2.06, bv: 1.01 },
  { name: "Saiph", ra: 5.7959, dec: -9.6696, mag: 2.07, bv: -0.17 },
  { name: "Alpheratz", ra: 0.1398, dec: 29.0904, mag: 2.07, bv: -0.11 },
  { name: "Kochab", ra: 14.8451, dec: 74.1555, mag: 2.07, bv: 1.47 },
  { name: "Tiaki", ra: 22.7111, dec: -46.8846, mag: 2.07, bv: 1.62 },
  { name: "Rasalhague", ra: 17.5822, dec: 12.5600, mag: 2.08, bv: 0.16 },
  { name: "Algol", ra: 3.1361, dec: 40.9556, mag: 2.09, bv: -0.05 },
  { name: "Almach", ra: 2.0650, dec: 42.3297, mag: 2.10, bv: 1.37 },
  { name: "Denebola", ra: 11.8177, dec: 14.5721, mag: 2.14, bv: 0.09 },
  { name: "Navi", ra: 0.9450, dec: 60.7167, mag: 2.15, bv: -0.15 },
  { name: "Muhlifain", ra: 12.6917, dec: -48.9594, mag: 2.20, bv: -0.01 },
  { name: "Naos", ra: 8.0597, dec: -40.0031, mag: 2.21, bv: -0.27 },
  { name: "Aspidiske", ra: 9.2848, dec: -59.2752, mag: 2.21, bv: 0.18 },
  { name: "Alphecca", ra: 15.5781, dec: 26.7147, mag: 2.22, bv: -0.02 },
  { name: "Suhail", ra: 9.1333, dec: -43.4326, mag: 2.23, bv: 1.66 },
  { name: "Sadr", ra: 20.3705, dec: 40.2567, mag: 2.23, bv: 0.68 },
  { name: "Mizar", ra: 13.3988, dec: 54.9254, mag: 2.23, bv: 0.06 },
  { name: "Eltanin", ra: 17.9434, dec: 51.4889, mag: 2.24, bv: 1.52 },
  { name: "Schedar", ra: 0.6751, dec: 56.5373, mag: 2.24, bv: 1.17 },
  { name: "Mintaka", ra: 5.5334, dec: -0.2991, mag: 2.25, bv: -0.18 },
  { name: "Caph", ra: 0.1530, dec: 59.1498, mag: 2.28, bv: 0.38 },
  { name: "Dschubba", ra: 16.0056, dec: -22.6217, mag: 2.29, bv: -0.12 },
  { name: "Larawag", ra: 16.8361, dec: -34.2932, mag: 2.29, bv: 1.15 },
  { name: "Merak", ra: 11.0307, dec: 56.3824, mag: 2.34, bv: 0.03 },
  { name: "Izar", ra: 14.7498, dec: 27.0742, mag: 2.35, bv: 0.97 },
  { name: "Enif", ra: 21.7364, dec: 9.8750, mag: 2.38, bv: 1.53 },
  { name: "Girtab", ra: 17.7081, dec: -39.0300, mag: 2.39, bv: -0.22 },
  { name: "Ankaa", ra: 0.4381, dec: -42.3061, mag: 2.40, bv: 1.08 },
  { name: "Phecda", ra: 11.8972, dec: 53.6948, mag: 2.41, bv: 0.00 },
  { name: "Sabik", ra: 17.1730, dec: -15.7249, mag: 2.43, bv: 0.06 },
  { name: "Scheat", ra: 23.0629, dec: 28.0828, mag: 2.44, bv: 1.67 },
  { name: "Aludra", ra: 7.4016, dec: -29.3031, mag: 2.45, bv: -0.08 },
  { name: "Markeb", ra: 9.3686, dec: -55.0107, mag: 2.47, bv: -0.18 },
  { name: "Markab", ra: 23.0793, dec: 15.2053, mag: 2.49, bv: -0.04 },
]);

/**
 * Nebulae and clusters, with the colours wide-field colour astrophotography
 * actually returns for them.
 *
 * Hydrogen-alpha dominates star-forming regions, which is why so much of this
 * list is red. Planetaries and supernova remnants run to teal because their
 * light is doubly-ionised oxygen. Reflection nebulae are blue for the same
 * reason the sky is. Dark nebulae are not dark objects, they are dust in front
 * of the band, so they are drawn by subtracting rather than adding.
 *
 * `size` is the apparent major axis in degrees.
 */
export const SKY_NEBULAE = Object.freeze([
  { name: "Orion Nebula", catalog: "M42", ra: 5.5881, dec: -5.3903, size: 1.08, colour: "#ff8a7a", kind: "emission" },
  { name: "Carina Nebula", catalog: "NGC 3372", ra: 10.7524, dec: -59.8678, size: 2.00, colour: "#ff9a86", kind: "emission" },
  { name: "Lagoon Nebula", catalog: "M8", ra: 18.0617, dec: -24.3800, size: 0.75, colour: "#ff8f8a", kind: "emission" },
  { name: "Trifid Nebula", catalog: "M20", ra: 18.0450, dec: -22.9717, size: 0.47, colour: "#ff7fa8", kind: "emission" },
  { name: "Eagle Nebula", catalog: "M16", ra: 18.3133, dec: -13.7983, size: 0.58, colour: "#ff8878", kind: "emission" },
  { name: "Omega Nebula", catalog: "M17", ra: 18.3464, dec: -16.1717, size: 0.37, colour: "#ff9080", kind: "emission" },
  { name: "North America Nebula", catalog: "NGC 7000", ra: 20.9883, dec: 44.5167, size: 2.00, colour: "#ff8a7a", kind: "emission" },
  { name: "Rosette Nebula", catalog: "NGC 2237", ra: 6.5625, dec: 4.9983, size: 1.30, colour: "#ff7d76", kind: "emission" },
  { name: "California Nebula", catalog: "NGC 1499", ra: 4.0194, dec: 36.4600, size: 2.42, colour: "#ff6f6f", kind: "emission" },
  { name: "Heart Nebula", catalog: "IC 1805", ra: 2.5450, dec: 61.4500, size: 2.00, colour: "#ff7f7a", kind: "emission" },
  { name: "Soul Nebula", catalog: "IC 1848", ra: 2.8569, dec: 60.4189, size: 1.50, colour: "#ff8878", kind: "emission" },
  { name: "Veil Nebula", catalog: "NGC 6960", ra: 20.7617, dec: 30.7167, size: 3.00, colour: "#6fd0e0", kind: "supernova-remnant" },
  { name: "Helix Nebula", catalog: "NGC 7293", ra: 22.4942, dec: -20.8375, size: 0.42, colour: "#6ee0c8", kind: "planetary" },
  { name: "Dumbbell Nebula", catalog: "M27", ra: 19.9934, dec: 22.7211, size: 0.13, colour: "#7fe0c0", kind: "planetary" },
  { name: "Pleiades", catalog: "M45", ra: 3.7833, dec: 24.1167, size: 1.83, colour: "#a8c8ff", kind: "open-cluster" },
  { name: "Hyades", catalog: "Melotte 25", ra: 4.4500, dec: 15.8667, size: 5.50, colour: "#ffd9b0", kind: "open-cluster" },
  { name: "Double Cluster", catalog: "NGC 869/884", ra: 2.3429, dec: 57.1325, size: 1.00, colour: "#cfe0ff", kind: "open-cluster" },
  { name: "Omega Centauri", catalog: "NGC 5139", ra: 13.4465, dec: -47.4795, size: 0.61, colour: "#fff0d0", kind: "globular-cluster" },
  { name: "47 Tucanae", catalog: "NGC 104", ra: 0.4014, dec: -72.0803, size: 0.83, colour: "#ffeccc", kind: "globular-cluster" },
  { name: "Beehive Cluster", catalog: "M44", ra: 8.6733, dec: 19.6700, size: 1.17, colour: "#dfe8ff", kind: "open-cluster" },
  { name: "Rho Ophiuchi", catalog: "IC 4604", ra: 16.4683, dec: -24.5417, size: 5.00, colour: "#ffb27a", kind: "reflection" },
  { name: "Coalsack", catalog: "Caldwell 99", ra: 12.8333, dec: -62.5000, size: 6.00, colour: "#241a16", kind: "dark" },
  { name: "Cygnus Rift", catalog: "Northern Coalsack", ra: 20.1000, dec: 36.0000, size: 18.00, colour: "#2a1d18", kind: "dark" },
]);

/**
 * The galaxies a dark sky actually shows.
 *
 * Andromeda is the one that matters here: at three degrees across it is six
 * times the width of the full Moon, and every photograph that makes it look
 * like a faint dot is a photograph of a bright core in a short exposure. It is
 * drawn as an inclined disc with a bright nucleus, which is what the eye gets.
 *
 * `sizeMajor`/`sizeMinor` are in degrees, `angle` is the position angle.
 */
export const SKY_GALAXIES = Object.freeze([
  { name: "Andromeda Galaxy", catalog: "M31", ra: 0.7123, dec: 41.2689, sizeMajor: 3.152, sizeMinor: 1.028, angle: 35, colour: "#ffe9c9", core: 1.0 },
  { name: "Triangulum Galaxy", catalog: "M33", ra: 1.5644, dec: 30.6581, sizeMajor: 1.145, sizeMinor: 0.693, angle: 23, colour: "#cfe0ff", core: 0.42 },
  { name: "Large Magellanic Cloud", catalog: "LMC", ra: 5.3929, dec: -69.7561, sizeMajor: 10.75, sizeMinor: 9.167, angle: 170, colour: "#fff2dc", core: 0.55 },
  { name: "Small Magellanic Cloud", catalog: "NGC 292", ra: 0.8792, dec: -72.8283, sizeMajor: 5.333, sizeMinor: 3.083, angle: 45, colour: "#fff0e0", core: 0.45 },
  { name: "Centaurus A", catalog: "NGC 5128", ra: 13.4247, dec: -43.0161, sizeMajor: 0.428, sizeMinor: 0.333, angle: 35, colour: "#ffe3c0", core: 0.6 },
  { name: "Bode's Galaxy", catalog: "M81", ra: 9.9260, dec: 69.0672, sizeMajor: 0.415, sizeMinor: 0.192, angle: 157, colour: "#ffeacf", core: 0.5 },
  // M82 is a starburst: tidally shaken by M81, forming stars ten times faster
  // than the whole Milky Way, and venting a superwind of ionised hydrogen
  // thousands of light-years out of both faces of the disc. Those red filaments
  // are the object -- drawn without them it is just another edge-on smudge.
  { name: "Cigar Galaxy", catalog: "M82", ra: 9.9317, dec: 69.6831, sizeMajor: 0.187, sizeMinor: 0.072, angle: 65, colour: "#ffd9b8", core: 0.62, starburst: 1.0 },
  // Also a starburst, and the nearest one after M82 -- weaker wind, more dust.
  { name: "Sculptor Galaxy", catalog: "NGC 253", ra: 0.7925, dec: -25.2875, sizeMajor: 0.483, sizeMinor: 0.113, angle: 52, colour: "#ffe6c2", core: 0.45, starburst: 0.55 },
  { name: "Whirlpool Galaxy", catalog: "M51", ra: 13.4979, dec: 47.1956, sizeMajor: 0.187, sizeMinor: 0.115, angle: 7, colour: "#dbe7ff", core: 0.45 },
  { name: "Sombrero Galaxy", catalog: "M104", ra: 12.6665, dec: -11.6225, sizeMajor: 0.143, sizeMinor: 0.070, angle: 89, colour: "#ffe8cc", core: 0.5 },
]);

/**
 * Right ascension and declination to a scene direction.
 *
 * The celestial pole is +Y, which puts the ecliptic near the XZ plane the
 * planets orbit in -- close enough that the two agree about which way is up
 * without a full obliquity rotation being carried through every layer.
 */
export function celestialToVector(raHours, decDegrees, target) {
  const ra = (raHours * Math.PI) / 12;
  const dec = (decDegrees * Math.PI) / 180;
  const cosDec = Math.cos(dec);
  target.set(cosDec * Math.cos(ra), Math.sin(dec), -cosDec * Math.sin(ra));
  return target;
}

/**
 * B-V colour index to linear RGB.
 *
 * A fit to the blackbody locus rather than a lookup: one number in, a star
 * colour out. It matters more than it sounds -- a star field where every point
 * is white reads as a screensaver, and the real sky has Betelgeuse and Antares
 * visibly orange a few degrees from stars that are visibly blue.
 */
export function colourFromBV(bv, target) {
  const t = Math.max(-0.4, Math.min(2.0, bv));
  let r;
  let g;
  let b;
  if (t < 0.0) { r = 0.61 + 0.11 * t + 0.1 * t * t; g = 0.70 + 0.07 * t + 0.1 * t * t; b = 1.0; }
  else if (t < 0.4) { r = 0.83 + 0.17 * t; g = 0.87 + 0.11 * t; b = 1.0; }
  else if (t < 1.6) { r = 1.0; g = 0.98 - 0.16 * (t - 0.4); b = 1.0 - 0.47 * (t - 0.4) - 0.10 * (t - 0.4) * (t - 0.4); }
  else { r = 1.0; g = 0.79 - 0.10 * (t - 1.6); b = 0.40 - 0.10 * (t - 1.6); }
  target.setRGB(
    Math.max(0, Math.min(1, r)),
    Math.max(0, Math.min(1, g)),
    Math.max(0, Math.min(1, b)),
  );
  return target;
}
