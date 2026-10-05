"""
Surface detail maps for the fifteen small bodies.

Run from this directory:

    python3 build-small-body-textures.py      # needs numpy, scipy, Pillow

Writes 1024x512 JPEGs to ../../public/assets/textures/smallbodies/ and prints,
for each one, the mean linear value that `smallBodies.js` needs in order to
keep the body's measured albedo intact.  See README.md for the method and for
what is real in each map and what is not.
"""

import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

_NOISE = {}

REF = "reference"
# Where the maps land. `SBT_OUT` exists so a build can be inspected in a
# scratch directory before anything in public/ is overwritten -- which is
# worth doing, because a bad patch pick is only obvious in the finished map.
OUT = os.environ.get("SBT_OUT", "../../public/assets/textures/smallbodies")

# Two sizes, and the reason is evidence rather than screen space.
#
# The fifteen Rank 1 bodies are grown from photographs of themselves, so there
# is real detail to carry and they get 1024x512. The eleven large main-belt
# worlds have never been photographed at all -- their relief is borrowed from
# a spectral analogue and their shape is an ellipsoid -- so a map twice as
# fine would be twice as much invented detail, and they get 512x256. It also
# keeps the whole set under four megabytes.
W, H = 1024, 512
LON = LAT = None


def set_size(width, height):
    global W, H, LON, LAT
    W, H = width, height
    LON, LAT = np.meshgrid(np.linspace(-180, 180, W, endpoint=False),
                           np.linspace(90, -90, H))
    # Every cached noise field is the wrong shape now.
    _NOISE.clear()




# --------------------------------------------------------------------------
# What each body gets, and where it comes from.
#
# `source` is a real spacecraft photograph unless `analogue` is set, in which
# case no photograph of that body was available to this build and its relief
# is borrowed from the named body -- always one imaged at close range in the
# same spectral class, never a guess dressed up as a picture.  Which is which
# is stated per body below and repeated in the README, because the difference
# matters and a texture file cannot carry a footnote.
# --------------------------------------------------------------------------
BODIES = {
    # ---- imaged from a spacecraft, at close range, in focus ---------------
    "bennu": dict(
        source="bennu-osiris-rex.jpg",
        credit="NASA/Goddard/University of Arizona -- OSIRIS-REx OCAMS PolyCam, "
               "global mosaic released 2 December 2018",
        detail=1.30, stamps=620, seed=101,
        # Bennu is a spinning top: a raised equatorial ridge running right
        # round it, thrown up by its own rotation. Lauretta et al. 2019,
        # Nature 568, 55. The surface is boulder-covered almost everywhere --
        # the sample site was chosen because it was one of the few patches
        # clear enough to touch.
        craters=(160, (1.2, 16.0), 0.13), boulders=(1400, (0.25, 3.0), 0.34),
        features=[("band", dict(lat=0.0, width=17.0, gain=0.10))],
    ),
    "ryugu": dict(
        source="ryugu-hayabusa2.png",
        credit="JAXA/University of Tokyo and collaborators -- Hayabusa2 ONC-T, "
               "approach imaging, June 2018",
        detail=1.45, stamps=700, seed=102,
        # The same top shape and the same equatorial ridge, called Ryujin
        # Dorsum. Watanabe et al. 2019, Science 364, 268. Otohime Saxum, the
        # 160 m boulder at the south pole, is the largest single feature on
        # the body and is put back below.
        craters=(90, (2.5, 18.0), 0.14), boulders=(1200, (0.25, 2.5), 0.30),
        features=[
            ("band", dict(lat=0.0, width=15.0, gain=0.09)),
            ("spot", dict(lat=-72.0, lon=35.0, radius=16.0, gain=0.30, rim=0.0)),
        ],
    ),
    "itokawa": dict(
        contrastCap=0.24,
        source="itokawa-hayabusa-amica.jpg",
        credit="JAXA -- Hayabusa AMICA, 2005. (Supplied as '99942 Apophis.jpg'; "
               "it is Itokawa. Apophis has never been resolved by a spacecraft.)",
        detail=1.35, stamps=680, seed=103,
        # Two lumps of gravel resting against each other, and the one thing
        # everyone knows about it is the contrast: boulder fields over most of
        # the body and the smooth Muses Sea regolith pond in the waist, where
        # fine grains have collected in the gravitational low.
        # Fujiwara et al. 2006, Science 312, 1330.
        craters=(38, (3.5, 14.0), 0.09), boulders=(1600, (0.30, 3.5), 0.38),
        # Final round: the pond still read as a bright, blurred, bald disc.
        # The Muses Sea is *finer*, not brighter or emptier -- AMICA frames
        # show cm-scale gravel all over it at roughly the albedo of the rest
        # of the surface (Miyamoto et al. 2007, Science 316, 1011; Yano et al.
        # 2006, Science 312, 1350). So it keeps most of its relief (keep 0.62
        # against the default 0.34), carries half again as much fine grain,
        # is lifted 5% rather than 13%, and is blurred less (3 px, not 4).
        features=[("smooth", dict(lat=-5.0, lon=0.0, radius=28.0, gain=0.05, blur=3.0,
                                  keep=0.62, fines=1.5))],
    ),
    "eros": dict(
        contrastCap=0.2,
        source="eros-near-global-mosaic.jpg",
        credit="NASA/JHU APL -- NEAR Shoemaker MSI, global mosaic, 2000",
        detail=1.20, stamps=640, seed=104,
        # Himeros, the 10 km saddle, and Psyche, the 5.3 km crater opposite
        # it, are the two features that define the body's shape in every
        # image of it. Veverka et al. 2000, Science 289, 2088.
        craters=(400, (0.6, 14.0), 0.17), boulders=(500, (0.15, 1.2), 0.22),
        features=[
            ("smooth", dict(lat=10.0, lon=-95.0, radius=24.0, gain=0.10, blur=4.0)),
            ("spot", dict(lat=-5.0, lon=90.0, radius=18.0, gain=-0.14, rim=0.10)),
        ],
    ),
    "gaspra": dict(
        contrastCap=0.22,
        source="gaspra-galileo.jpg",
        credit="NASA/JPL -- Galileo SSI, 29 October 1991",
        detail=1.25, stamps=600, seed=105,
        # A collision fragment: sharp unsoftened facets and a crater
        # population too young for the belt, which is what dated the family.
        # Belton et al. 1992, Science 257, 1647.
        craters=(300, (0.8, 6.0), 0.13), boulders=(200, (0.15, 1.0), 0.18),
        features=[],
    ),
    "ida": dict(
        source="ida-dactyl-galileo.jpg",
        credit="NASA/JPL -- Galileo SSI colour composite, 28 August 1993",
        detail=1.15, stamps=620, seed=106,
        # Koronis-family regolith, with fresh craters exposing brighter,
        # less space-weathered material. Belton et al. 1996, Icarus 120, 1.
        craters=(500, (0.5, 9.0), 0.16), boulders=(300, (0.12, 1.0), 0.18),
        features=[],
    ),
    "lutetia": dict(
        source="lutetia-rosetta.jpg",
        credit="ESA 2010 MPS for OSIRIS Team -- Rosetta OSIRIS NAC, 10 July 2010",
        detail=1.30, stamps=640, seed=107,
        # The Baetica cluster at the north pole is the youngest terrain on the
        # body and the brightest: a group of overlapping craters with a
        # landslide inside the largest. Sierks et al. 2011, Science 334, 487.
        craters=(450, (0.6, 12.0), 0.15), boulders=(150, (0.12, 0.9), 0.15),
        features=[("spot", dict(lat=68.0, lon=0.0, radius=30.0, gain=0.16, rim=0.06))],
    ),
    "comet67p": dict(
        contrastCap=0.26,
        source="comet67p-rosetta-navcam.jpg",
        credit="ESA/Rosetta/NAVCAM, CC BY-SA IGO 3.0 -- 2014-2016",
        detail=1.40, stamps=700, seed=108,
        # Hapi, the neck between the two lobes, is smoother and measurably
        # brighter than either of them: fallback dust collects there, and it
        # was the most active region on the nucleus before perihelion.
        # Sierks et al. 2015, Science 347, aaa1044.
        craters=(60, (1.5, 7.0), 0.20), boulders=(250, (0.30, 2.0), 0.16),
        features=[("smooth", dict(lat=0.0, lon=0.0, radius=24.0, gain=0.16, blur=5.0))],
    ),
    "arrokoth": dict(
        source="arrokoth-new-horizons.png",
        credit="NASA/JHU APL/SwRI -- New Horizons LORRI + MVIC, 1 January 2019",
        detail=1.10, stamps=560, seed=109,
        # The neck where the two lobes meet is the brightest and the least red
        # ground on the body, and Maryland, the 7 km depression on the small
        # lobe, is its only large crater. Stern et al. 2019, Science 364,
        # aaw9771; Spencer et al. 2020, Science 367, aay3999.
        craters=(20, (2.0, 10.0), 0.10), boulders=(60, (0.40, 1.6), 0.12),
        features=[
            ("band", dict(lat=0.0, width=9.0, gain=0.22)),
            ("spot", dict(lat=22.0, lon=120.0, radius=15.0, gain=-0.12, rim=0.07)),
        ],
    ),

    # ---- no photograph available to this build ---------------------------
    "mathilde": dict(
        analogue="bennu",
        credit="No NEAR photograph was supplied; the file in images/ is a 3D "
               "render. Relief borrowed from Bennu -- both are C-type "
               "carbonaceous, both imaged as uniformly dark with no detected "
               "colour variation. Craters after Veverka et al. 1999, Icarus 140, 3.",
        detail=1.05, stamps=600, seed=110,
        # Five craters wider than 20 km on a body 53 km across, two of them --
        # Karoo and Ishikari -- roughly as deep as the asteroid's own radius.
        # It survived them because half of it is empty space.
        craters=(80, (1.0, 8.0), 0.18), boulders=(0, (0.2, 1.0), 0.0),
        features=[
            ("spot", dict(lat=15.0, lon=-40.0, radius=34.0, gain=-0.20, rim=0.13)),
            ("spot", dict(lat=-30.0, lon=70.0, radius=28.0, gain=-0.17, rim=0.11)),
            ("spot", dict(lat=48.0, lon=150.0, radius=22.0, gain=-0.14, rim=0.09)),
        ],
    ),
    "didymos": dict(
        analogue="itokawa",
        credit="DART imaged Didymos in 2022 but no frame of it was supplied; "
               "relief borrowed from Itokawa, the nearest imaged analogue -- "
               "both are S-type rubble piles spun near their shedding limit. "
               "Equatorial ridge after Daly et al. 2023, Nature 616, 443.",
        detail=1.30, stamps=620, seed=111,
        craters=(60, (1.5, 9.0), 0.11), boulders=(700, (0.25, 2.2), 0.26),
        features=[("band", dict(lat=0.0, width=14.0, gain=0.09))],
    ),
    "dimorphos": dict(
        analogue="itokawa",
        credit="Relief borrowed from Itokawa for the same reason as Didymos. "
               "DART's last frames showed a surface of loose boulders with no "
               "exposed bedrock at all -- Daly et al. 2023.",
        detail=1.50, stamps=520, seed=112,
        craters=(12, (2.0, 8.0), 0.08), boulders=(1400, (0.40, 4.0), 0.34),
        features=[],
    ),
    "apophis": dict(
        contrastCap=0.22,
        analogue="itokawa",
        credit="Apophis has never been resolved by any spacecraft -- everything "
               "known about its shape is from Goldstone and Arecibo radar "
               "(Brozovic et al. 2018, Icarus 300, 115). Relief borrowed from "
               "Itokawa: the same Sq/S taxonomic family and the same elongated "
               "contact-binary form the radar solution shows. This is an "
               "analogue, not a picture of Apophis.",
        detail=1.30, stamps=600, seed=113,
        craters=(80, (1.5, 10.0), 0.12), boulders=(500, (0.30, 2.5), 0.28),
        features=[],
    ),
    "halley": dict(
        contrastCap=0.26,
        analogue="comet67p",
        credit="Giotto's 1986 flyby is the only close look anyone has had, and "
               "no frame of it was supplied. Relief borrowed from 67P, the "
               "best-mapped cometary nucleus there is. Halley's albedo of 0.04 "
               "-- darker than coal, the least reflective surface measured in "
               "the Solar System -- is carried by the catalogue, not by this "
               "map. Keller et al. 1986, Nature 321, 320.",
        detail=1.35, stamps=660, seed=114,
        # Giotto saw two bright jets on the sunward side against an otherwise
        # uniformly black crust. They are active vents, not albedo features,
        # but they are the only large-scale structure the flyby resolved.
        craters=(40, (2.0, 9.0), 0.12), boulders=(0, (0.2, 1.0), 0.0),
        features=[
            ("spot", dict(lat=18.0, lon=-30.0, radius=13.0, gain=0.34, rim=0.0)),
            ("spot", dict(lat=-8.0, lon=25.0, radius=10.0, gain=0.26, rim=0.0)),
        ],
    ),
    "dactyl": dict(
        analogue="ida",
        credit="Galileo resolved Dactyl across about 24 pixels -- enough to "
               "count craters on it, not enough to build a map from. Relief "
               "borrowed from its parent Ida, which is where it came from: "
               "both are Koronis-family fragments. Veverka et al. 1994.",
        detail=1.20, stamps=420, seed=115,
        craters=(14, (5.0, 16.0), 0.16), boulders=(40, (0.5, 2.0), 0.20),
        features=[],
    ),

    # ---- Rank 2: the eleven large main-belt worlds, and six moons --------
    #
    # None of these has ever been photographed by a spacecraft. Their shapes
    # are measured -- VLT/SPHERE resolved every one of them into a disc and a
    # tri-axial ellipsoid -- and their relief is borrowed from the nearest
    # visited body of the same spectral class. Each card says so. The
    # borrowing is per class, not per body, because that is the only claim the
    # data supports: an S-type surface looks like an S-type surface.
    #
    # `size` halves the map for all of them. See the note at the top.
    # ---- Rank 3: the four Centaurs -------------------------------------
    #
    # A harder case than Rank 2, and the maps say so. Those eleven at least
    # had a resolved disc; these four have never been anything but a point of
    # light, and everything known about their sizes and shapes comes from
    # timing how long a star stayed hidden behind them. So the borrowing here
    # is by *kind of body* rather than by spectral class -- a dark
    # carbonaceous 250 km world, a cold ice-rich one, a heavily cratered
    # primitive fragment, a comet nucleus -- and the colour, which for all
    # four is measured to a few hundredths of a magnitude, is carried by the
    # catalogue's vertex chroma and not by these maps.
    #
    # Full size, unlike Rank 2. These are destinations rather than background:
    # the tour lands on them, the camera frames them, and two of them can be
    # zoomed past their own rings to the ground. Four maps at 1024 x 512 is
    # about 700 kB on top of the set's 2.3 MB.
    "chariklo": dict(
        analogue="mathilde",
        contrastCap=0.22,
        credit="Never resolved by anything. Borrows Mathilde's settings, which "
               "means the pixels are Bennu's: Mathilde has no photograph in "
               "this build either, so the chain is Chariklo -> Mathilde -> "
               "Bennu, re-contrasted at each step. That is the right loan "
               "anyway -- Bennu, Mathilde and Chariklo are all carbonaceous "
               "and all imaged, or measured, as uniformly dark with no "
               "detected colour variation, at albedos of 0.044, 0.0436 and "
               "0.036. Shape from stellar occultations, Morgado et al. 2021, "
               "A&A 652, A141. The rings are geometry, not texture; they are "
               "in icyRings.js.",
        detail=1.10, stamps=560, seed=201, grain=1.00,
        # Mathilde's defining feature is craters nearly as wide as the body,
        # and at 250 km Chariklo is in the same regime: big, old, and with
        # nothing to erase them.
        craters=(92, (1.5, 11.0), 0.13), boulders=(0, (0.2, 1.0), 0.0),
        features=[],
    ),
    "chiron": dict(
        analogue="arrokoth",
        # Raised from 0.19. At 0.19 this was the smoothest map in the set by
        # a wide margin and Chiron rendered as a flat pale ball -- reported
        # as the glowing-ness not looking real, and the map was half of why:
        # a body with no surface contrast has nothing for the eye to read as
        # rock, so every photon on it looks like glow. Its surface reflects
        # seven per cent of the light that reaches it, which is asphalt, and
        # asphalt is not smooth. 0.27 is still below the set median and it
        # keeps the mantled look that an outgassing body should have.
        contrastCap=0.27,
        credit="Never resolved. Relief borrowed from Arrokoth, the only cold "
               "ice-rich outer Solar System surface any spacecraft has "
               "photographed. Deliberately the most subdued map in the set: "
               "Chiron outgasses, and a body that periodically coats itself "
               "in its own fallback does not keep sharp craters. Shape from "
               "Braga-Ribas et al. 2023, A&A 676, A72.",
        detail=1.22, stamps=520, seed=202, grain=0.95,
        craters=(84, (1.5, 11.0), 0.125), boulders=(0, (0.2, 1.0), 0.0),
        features=[],
    ),
    "pholus": dict(
        # The one new photograph this round, and it is not of Pholus.
        #
        # Supplied as "Pholus.jpg"; it is Phobos, the Mars Express HRSC frame
        # with the 5 km scale bar on it. No harm done, because Pholus has
        # never been resolved by anything and was always going to need a
        # borrowed surface -- and a dark, primitive, crater-saturated body is
        # a fair loan for a Centaur. The card says Phobos.
        #
        # Two things on Phobos must not come across, and both of them did on
        # the first two attempts. Its grooves are Mars's doing and a
        # free-flying Centaur cannot have them; its fresh bright-rayed
        # craters are features rather than material. `representative` prices
        # both out -- see `pick_patch` -- and `window` is small because no
        # 220-pixel window of Phobos is groove-free. At 96 the chosen patch
        # comes back at coherence 0.06: even cratered ground, no lineation.
        source="phobos-mars-express-hrsc.jpg",
        representative=True,
        window=96,
        contrastCap=0.24,
        credit="NASA/ESA/DLR/FU Berlin -- Mars Express HRSC, of PHOBOS, not "
               "of Pholus. Pholus has never been resolved; relief is borrowed "
               "from the nearest imaged dark primitive body. Cropped to the "
               "body, median-filtered to undo JPEG ringing and unsharpened at "
               "sub-pixel radius, which raised its high-frequency energy 5-13% "
               "at matched scale and its usable area from 23% of the frame to "
               "61%. Pholus's own size is Herschel-PACS (Duffard et al. 2014) "
               "and its shape is the 0.60 mag lightcurve (Tegler et al. 2005).",
        detail=1.20, stamps=640, seed=203, grain=1.05,
        craters=(126, (1.0, 9.0), 0.15), boulders=(0, (0.2, 1.0), 0.0),
        features=[],
    ),
    "echeclus": dict(
        analogue="comet67p",
        contrastCap=0.25,
        credit="Never resolved. Relief borrowed from 67P/Churyumov-"
               "Gerasimenko, which for once is the right loan rather than the "
               "nearest one: Echeclus carries a comet designation of its own, "
               "174P, outbursts repeatedly, and 67P is the only cometary "
               "nucleus anyone has mapped. Shape and albedo from stellar "
               "occultations, Pereira et al. 2024, MNRAS 527, 3624.",
        detail=1.15, stamps=600, seed=204, grain=1.10,
        craters=(48, (2.0, 12.0), 0.14), boulders=(320, (0.3, 2.0), 0.24),
        features=[],
    ),

    "interamnia": dict(analogue="mathilde", size=(512, 256), grain=1.18, detail=1.00, stamps=420, seed=704,
        credit="B-type, never visited. Relief from Mathilde, the nearest imaged carbonaceous body. Shape from VLT/SPHERE (Hanus et al. 2020)",
        craters=(120, (1.0, 9.0), 0.11), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "europa52": dict(analogue="mathilde", size=(512, 256), grain=1.05, detail=1.05, stamps=420, seed=52,
        credit="C-type, never visited. Relief from Mathilde. Shape from Keck AO (Merline et al. 2013)",
        craters=(130, (1.0, 10.0), 0.12), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "davida": dict(analogue="mathilde", size=(512, 256), grain=0.92, detail=1.05, stamps=420, seed=511,
        credit="C-type, never visited. Relief from Mathilde. Shape from VLT/SPHERE (Vernazza et al. 2021)",
        # SPHERE resolved one very large southern depression -- the only
        # individual surface feature ever seen on Davida.
        craters=(130, (1.0, 10.0), 0.12), boulders=(0, (0.2, 1.0), 0.0),
        features=[("spot", dict(lat=-42.0, lon=20.0, radius=30.0, gain=-0.18, rim=0.12))]),
    "euphrosyne": dict(analogue="mathilde", size=(512, 256), grain=1.12, detail=1.00, stamps=420, seed=31,
        credit="C-type, never visited. Relief from Mathilde. Shape from VLT/SPHERE 2019",
        craters=(115, (1.0, 9.0), 0.11), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "cybele": dict(analogue="mathilde", size=(512, 256), grain=1.0, detail=1.00, stamps=420, seed=65,
        credit="P-type, never visited. Relief from Mathilde, the darkest primitive body anyone has imaged closely",
        craters=(120, (1.0, 9.0), 0.11), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "eunomia": dict(analogue="ida", size=(512, 256), grain=0.86, detail=1.10, stamps=420, seed=15,
        credit="S-type, never visited. Relief from Ida, an S-type of the same family kind. Shape from VLT/SPHERE (Vernazza et al. 2021)",
        craters=(140, (0.8, 9.0), 0.13), boulders=(120, (0.15, 0.9), 0.16), features=[]),
    "juno": dict(analogue="ida", size=(512, 256), grain=0.96, detail=1.10, stamps=420, seed=3,
        credit="S-type, never visited. Relief from Ida. Shape from VLT/SPHERE 2021; the large southern crater was resolved from the ground in 2003",
        craters=(135, (0.8, 9.0), 0.13), boulders=(120, (0.15, 0.9), 0.16),
        features=[("spot", dict(lat=-36.0, lon=-60.0, radius=26.0, gain=-0.19, rim=0.13))]),
    "sylvia": dict(analogue="lutetia", contrastCap=0.24, size=(512, 256), grain=1.08, detail=1.05, stamps=420, seed=87,
        credit="X-type, never visited. Relief from Lutetia, the nearest imaged X-type. Shape from the 2021 ADAM model",
        craters=(140, (0.9, 9.0), 0.12), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "camilla": dict(analogue="lutetia", contrastCap=0.24, size=(512, 256), grain=0.9, detail=1.05, stamps=420, seed=107,
        credit="X-type, never visited. Relief from Lutetia. Shape from Keck/VLT AO (Pajuelo et al. 2018)",
        craters=(135, (0.9, 9.0), 0.12), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "kalliope": dict(analogue="lutetia", contrastCap=0.25, size=(512, 256), grain=0.8, detail=1.10, stamps=420, seed=22,
        credit="M-type, never visited. Relief from Lutetia, which is itself M/Xk. Shape from AO (Ferrais et al. 2022)",
        craters=(110, (0.9, 8.0), 0.13), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "kleopatra": dict(analogue="lutetia", contrastCap=0.25, size=(512, 256), grain=0.74, detail=1.10, stamps=420, seed=216,
        credit="M-type dog-bone, never visited. Relief from Lutetia. Shape from Arecibo radar 2000 and VLT/SPHERE (Marchis et al. 2021)",
        craters=(95, (0.9, 7.0), 0.13), boulders=(0, (0.2, 1.0), 0.0), features=[]),

    # The six satellites take their parent's borrowed relief, at a quarter
    # size again -- none is more than 28 km across and none has ever been
    # resolved into anything but a point.
    "romulus": dict(analogue="lutetia", contrastCap=0.21, size=(256, 128), grain=1.1, detail=1.20, stamps=260, seed=8701,
        credit="Sylvia's outer moon. Never resolved; relief from Lutetia via its parent",
        craters=(60, (2.0, 14.0), 0.15), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "remus": dict(analogue="lutetia", contrastCap=0.21, size=(256, 128), grain=1.15, detail=1.20, stamps=260, seed=8702,
        credit="Sylvia's inner moon. Never resolved; relief from Lutetia via its parent",
        craters=(45, (2.5, 15.0), 0.15), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "linus": dict(analogue="lutetia", contrastCap=0.21, size=(256, 128), grain=1.08, detail=1.20, stamps=260, seed=2201,
        credit="Kalliope's moon. Never resolved; relief from Lutetia via its parent",
        craters=(65, (2.0, 13.0), 0.15), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "alexhelios": dict(analogue="lutetia", contrastCap=0.2, size=(256, 128), grain=1.2, detail=1.25, stamps=260, seed=21601,
        credit="Kleopatra's outer moon. Never resolved; relief from Lutetia via its parent",
        craters=(35, (3.0, 16.0), 0.16), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "cleoselene": dict(analogue="lutetia", contrastCap=0.2, size=(256, 128), grain=1.22, detail=1.25, stamps=260, seed=21602,
        credit="Kleopatra's inner moon. Never resolved; relief from Lutetia via its parent",
        craters=(30, (3.0, 16.0), 0.16), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "euphrosyne-moon": dict(analogue="mathilde", contrastCap=0.2, size=(256, 128), grain=1.25, detail=1.25, stamps=260, seed=3101,
        credit="Euphrosyne's four-kilometre companion, provisional designation only. Never resolved; relief from Mathilde via its parent",
        craters=(28, (3.0, 16.0), 0.16), boulders=(0, (0.2, 1.0), 0.0), features=[]),

    # Rank 4, batch A. Only the bodies with no reference image are built
    # here -- Mani, Achlys, Uni, Rumina and four moons. The other ten and Huya
    # I have colour maps from ../dwarf-textures (build-dwarf-textures.py, then
    # to-small-body.py); building them here would overwrite those with grey.
    # Relief
    # borrowed from Arrokoth, the only cold outer Solar System surface any
    # spacecraft has photographed -- the same loan Chiron takes, for the
    # same reason. Half-size maps, like Rank 2: these draw at a few pixels
    # to a few hundred, and a finer map of a body nobody has resolved is
    # only more invented detail. contrastCap 0.20-0.22, lower than the
    # rocky bodies, because a 700 km icy world has relaxed most of its
    # relief away; the one measured exception, Mani, carries its crater
    # in the mesh.
    "mani": dict(analogue="arrokoth", contrastCap=0.2, size=(512, 256), grain=1.0, detail=1.10, stamps=420, seed=307,
        credit="Máni. Never resolved; outline from nine occultations (Rommel et al. 2023). The 322 km crater and the rise are geometry, not texture. Relief borrowed from Arrokoth",
        craters=(70, (1.0, 8.0), 0.10), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "achlys": dict(analogue="arrokoth", contrastCap=0.2, size=(512, 256), grain=0.92, detail=1.10, stamps=420, seed=208,
        credit="Achlys. Never resolved; shape from four occultations (Dias-Oliveira et al. 2017). Relief borrowed from Arrokoth",
        craters=(70, (1.0, 8.0), 0.10), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "uni": dict(analogue="arrokoth", contrastCap=0.21, size=(512, 256), grain=0.98, detail=1.10, stamps=420, seed=556,
        credit="Uni. Never resolved; size from Spitzer and Herschel, mass from Tinia (Brown 2013). Relief borrowed from Arrokoth",
        craters=(70, (1.0, 8.0), 0.10), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "rumina": dict(analogue="arrokoth", contrastCap=0.2, size=(512, 256), grain=0.9, detail=1.10, stamps=420, seed=1454,
        credit="Rumina. Never resolved; size from Herschel (Farkas-Takacs et al. 2020). Strong water ice. Relief borrowed from Arrokoth",
        craters=(70, (1.0, 8.0), 0.10), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "chiminigagua-moon": dict(analogue="arrokoth", contrastCap=0.2, size=(256, 128), grain=1.1, detail=1.20, stamps=260, seed=5321,
        credit="Chiminigagua's unnamed moon. A dot in one Hubble frame; relief from Arrokoth via its parent",
        craters=(35, (2.0, 12.0), 0.12), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "achlys-moon": dict(analogue="arrokoth", contrastCap=0.2, size=(256, 128), grain=1.1, detail=1.20, stamps=260, seed=2081,
        credit="Achlys's unnamed moon. Never resolved; relief from Arrokoth via its parent",
        craters=(35, (2.0, 12.0), 0.12), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "tinia": dict(analogue="arrokoth", contrastCap=0.2, size=(256, 128), grain=1.1, detail=1.20, stamps=260, seed=5561,
        credit="Tinia, Uni's moon. Never resolved; relief from Arrokoth via its parent",
        craters=(35, (2.0, 12.0), 0.12), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "gohu": dict(analogue="arrokoth", contrastCap=0.2, size=(256, 128), grain=1.1, detail=1.20, stamps=260, seed=2291,
        credit="Go!o'e =Hu, moon of G!kun||'homdima. Never resolved; relief from Arrokoth via its parent",
        craters=(35, (2.0, 12.0), 0.12), boulders=(0, (0.2, 1.0), 0.0), features=[]),

    # Rank 4, batch B: the near-equal binaries. Every component is a point of
    # light -- none has been resolved, and the pairs are only split by Hubble
    # -- so all eleven take Arrokoth's relief, which is the one surface any
    # spacecraft has photographed in exactly this population: Sila-Nunam,
    # Teharonhiawako, Altjira and Manwe are cold classicals like Arrokoth.
    # Half size for the near-equal partners, quarter size for the three that
    # are distinctly smaller (Paha, Sawiskera, Thorondor), as for the batch A
    # moons.
    "lempo": dict(analogue="arrokoth", contrastCap=0.22, size=(512, 256), grain=1.0, detail=1.10, stamps=420, seed=4717,
        credit="Lempo. Never resolved; split from Hiisi and Paha by Hubble (Benecchi et al. 2010). Relief borrowed from Arrokoth",
        craters=(70, (1.0, 8.0), 0.10), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "hiisi": dict(analogue="arrokoth", contrastCap=0.22, size=(512, 256), grain=0.95, detail=1.10, stamps=420, seed=4718,
        credit="Hiisi, Lempo's inner partner. Never resolved. Relief borrowed from Arrokoth",
        craters=(70, (1.0, 8.0), 0.10), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "paha": dict(analogue="arrokoth", contrastCap=0.22, size=(256, 128), grain=1.1, detail=1.20, stamps=260, seed=4719,
        credit="Paha, the outer companion of Lempo and Hiisi. Never resolved. Relief borrowed from Arrokoth",
        craters=(35, (2.0, 12.0), 0.12), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "sila": dict(analogue="arrokoth", contrastCap=0.22, size=(512, 256), grain=1.0, detail=1.10, stamps=420, seed=7936,
        credit="Sila. Never resolved; mutual eclipses with Nunam 2009-2017 (Grundy et al. 2012). Relief borrowed from Arrokoth",
        craters=(70, (1.0, 8.0), 0.10), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "nunam": dict(analogue="arrokoth", contrastCap=0.22, size=(512, 256), grain=0.95, detail=1.10, stamps=420, seed=7937,
        credit="Nunam, Sila's partner. Never resolved. Relief borrowed from Arrokoth",
        craters=(70, (1.0, 8.0), 0.10), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "teharonhiawako": dict(analogue="arrokoth", contrastCap=0.22, size=(512, 256), grain=1.0, detail=1.10, stamps=420, seed=8861,
        credit="Teharonhiawako. Never resolved; split from Sawiskera from the ground (Osip et al. 2003). Relief borrowed from Arrokoth",
        craters=(70, (1.0, 8.0), 0.10), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "sawiskera": dict(analogue="arrokoth", contrastCap=0.22, size=(256, 128), grain=1.1, detail=1.20, stamps=260, seed=8862,
        credit="Sawiskera, Teharonhiawako's partner. Never resolved. Relief borrowed from Arrokoth",
        craters=(35, (2.0, 12.0), 0.12), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "altjira": dict(analogue="arrokoth", contrastCap=0.22, size=(512, 256), grain=1.0, detail=1.10, stamps=420, seed=1487,
        credit="Altjira. Never resolved; split from its partner by Hubble (Grundy et al. 2011). Relief borrowed from Arrokoth",
        craters=(70, (1.0, 8.0), 0.10), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "altjira-moon": dict(analogue="arrokoth", contrastCap=0.22, size=(512, 256), grain=0.95, detail=1.10, stamps=420, seed=1488,
        credit="Altjira's unnamed partner. Never resolved. Relief borrowed from Arrokoth",
        craters=(70, (1.0, 8.0), 0.10), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "manwe": dict(analogue="arrokoth", contrastCap=0.22, size=(512, 256), grain=1.0, detail=1.10, stamps=420, seed=3854,
        credit="Manwe. Never resolved; a two-lobed contact binary from its lightcurve (Rabinowitz et al. 2019). Relief borrowed from Arrokoth, also a contact binary",
        craters=(70, (1.0, 8.0), 0.10), boulders=(0, (0.2, 1.0), 0.0), features=[]),
    "thorondor": dict(analogue="arrokoth", contrastCap=0.22, size=(256, 128), grain=1.1, detail=1.20, stamps=260, seed=3855,
        credit="Thorondor, Manwe's partner. Never resolved. Relief borrowed from Arrokoth",
        craters=(35, (2.0, 12.0), 0.12), boulders=(0, (0.2, 1.0), 0.0), features=[]),
}


# --------------------------------------------------------------------------
# Helpers.  `smoothstep`, `grow_patch`, `equalise_resolution`, `sphere_noise`
# and `close_the_poles` are the dwarf-planet pipeline's, reduced to one
# channel; see ../dwarf-textures/README.md for why each of them exists.  The
# reasoning is identical and is not repeated here.
# --------------------------------------------------------------------------

def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def sphere_noise(freq, seed, octaves=3):
    key = (freq, seed, octaves)
    if key in _NOISE:
        return _NOISE[key]
    la, lo = np.radians(LAT), np.radians(LON)
    pts = np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])
    total = np.zeros((H, W))
    amp = 1.0
    for o in range(octaves):
        n = 24 * (2 ** o)
        grid = np.random.default_rng(seed + o).random((n, n, n))
        coords = (pts * freq * (2 ** o) * 0.5 + 0.5) * n
        total += (ndimage.map_coordinates(grid, coords, order=1, mode="grid-wrap") - 0.5) * amp
        amp *= 0.55
    _NOISE[key] = total / 1.55
    return _NOISE[key]


def angular_distance(lat0, lon0):
    """Great-circle distance in degrees from every map pixel to one point."""
    la, lo = np.radians(LAT), np.radians(LON)
    la0, lo0 = np.radians(lat0), np.radians(lon0)
    cosd = (np.sin(la) * np.sin(la0)
            + np.cos(la) * np.cos(la0) * np.cos(lo - lo0))
    return np.degrees(np.arccos(np.clip(cosd, -1, 1)))


# --------------------------------------------------------------------------
# Choosing the patch, by measurement rather than by eye.
# --------------------------------------------------------------------------

def pick_patch(lum, mask, size, representative=False):
    """
    The squarest, best-lit, most detailed piece of real surface in the frame.

    Eyeballing a rectangle out of each photograph would be quicker and would
    not survive anyone swapping a reference image.  Instead every candidate
    window is scored on three things and the best one wins:

      * it must lie **entirely** on the body, with a margin -- a window that
        clips the limb brings a slice of empty space in with it, and empty
        space stamped nine hundred times is a hole in the map;
      * its mean brightness must be in the middle of the range, because a
        window in shadow has no recoverable detail and a window near
        saturation has had its detail clipped away;
      * among what is left, the most high-frequency variance wins, which is
        the definition of the thing being harvested.

    The margin is eroded from the mask rather than taken from the bounding
    box, so it follows the real silhouette of a peanut or a duck instead of
    assuming a disc.

    ## `representative`, and the two ways "most detailed wins" goes wrong

    Pholus found both of them. It has never been photographed, so its relief
    is borrowed from the Mars Express frame of Phobos -- a fair loan for a
    dark, crater-saturated primitive body. Run plain, the picker chose a
    window centred on a fresh crater with a **bright ray system**, and the
    first Pholus map came out as bright fibrous streaks. Told to avoid that,
    it moved onto Phobos's **grooves** instead: parallel lineations a
    kilometre wide, almost certainly Mars's doing through tidal stress or its
    own secondary ejecta, which a free-flying Centaur with no planet to be
    worked by cannot have. Either one, stamped six hundred times across a
    whole world, is a lie about the surface.

    Both are the same mistake: the most detailed window in a photograph is
    usually a *feature*, and what the harvest wants is *material*. So a
    source can ask for a representative window instead, and two measurements
    price the features out:

      * **skewness** of the high-frequency field. Regolith is close to
        symmetric about its own mean; a bright ray system is strongly
        positively skewed. Measured over this frame the median window is at
        0.42 and the ray crater the picker first chose was at 1.42.
      * **coherence**, from the structure tensor of the same field. Zero
        where detail runs equally in all directions, one where it all runs
        one way. A crater field is near zero; a groove field is not.

    Even with both, no 220-pixel window of Phobos is groove-free, because
    most of Phobos is grooved. That is what `window` is for: a smaller patch
    can fit between them. At 96 pixels the best window comes back at skew
    0.43 and coherence 0.06 -- even, cratered ground with no lineation in it
    at all.

    Both are opt-in rather than always on, because turning them on by default
    would silently re-pick the window for all twenty-eight maps already built
    and checked. Any future source with lineations or a bright ray system the
    borrower cannot have -- Eros's ridges, Vesta's troughs -- should set them.
    """
    h, w = lum.shape
    inner = ndimage.binary_erosion(mask, iterations=max(3, size // 8))
    if not inner.any():
        inner = mask
    # Local statistics at window scale, computed once for the whole frame.
    cover = ndimage.uniform_filter(inner.astype(np.float64), size=size)
    mean = ndimage.uniform_filter(lum, size=size)
    sq = ndimage.uniform_filter(lum * lum, size=size)
    var = np.maximum(sq - mean * mean, 0)
    high = lum - ndimage.gaussian_filter(lum, size / 6.0)
    detail = ndimage.uniform_filter(high * high, size=size)

    exposure = smoothstep(0.10, 0.28, mean) * (1 - smoothstep(0.72, 0.92, mean))
    weight = detail * exposure
    if representative:
        third = ndimage.uniform_filter(high ** 3, size=size)
        skew = third / np.maximum(detail, 1e-12) ** 1.5
        gy, gx = np.gradient(high)
        jxx = ndimage.uniform_filter(gx * gx, size=size)
        jyy = ndimage.uniform_filter(gy * gy, size=size)
        jxy = ndimage.uniform_filter(gx * gy, size=size)
        trace = np.maximum(jxx + jyy, 1e-12)
        coherence = np.sqrt((jxx - jyy) ** 2 + 4 * jxy * jxy) / trace
        weight = (weight
                  * np.exp(-((skew / 0.55) ** 2))
                  * np.power(np.clip(1.0 - coherence, 0.0, 1.0), 3.0))
    score = np.where(cover > 0.995, weight, -1.0)
    # Never let the window run off the frame.
    half = size // 2
    score[:half + 1, :] = -1
    score[-half - 1:, :] = -1
    score[:, :half + 1] = -1
    score[:, -half - 1:] = -1
    if score.max() <= 0:
        # Nothing clean enough: fall back to the centre of mass of the body.
        cy, cx = ndimage.center_of_mass(mask)
        cy, cx = int(cy), int(cx)
    else:
        cy, cx = np.unravel_index(np.argmax(score), score.shape)
    y0 = int(np.clip(cy - half, 0, h - size))
    x0 = int(np.clip(cx - half, 0, w - size))
    return y0, x0, float(var[cy, cx])


def relief_from(source, detail, representative=False, window=None):
    """
    The material, with the lamp divided out.

    What survives here is only the high-frequency part of the photograph --
    craters, boulders, grain -- normalised to a mean of one.  Everything
    broader than the patch is discarded deliberately: broad structure is what
    turns into visible symmetry when a patch is stamped, and it is also the
    part that is really the Sun's doing rather than the surface's.
    """
    img = Image.open(os.path.join(REF, source)).convert("RGB")
    rgb = np.asarray(img).astype(np.float64) / 255
    lum = rgb @ [0.2126, 0.7152, 0.0722]
    mask = lum > 0.06
    # A lone bright speck of background noise is not the body.
    mask = ndimage.binary_opening(mask, iterations=2)
    mask = ndimage.binary_fill_holes(mask)

    size = int(window) if window else int(np.clip(min(lum.shape) // 4, 48, 220))
    y0, x0, _ = pick_patch(lum, mask, size, representative=representative)
    patch = lum[y0:y0 + size, x0:x0 + size]

    base = np.maximum(ndimage.gaussian_filter(patch, size / 9.0), 1e-3)
    relief = np.clip(patch / base, 0.55, 1.75)
    relief = np.clip(1.0 + (relief - 1.0) * detail, 0.45, 1.95)
    return relief / relief.mean(), (y0, x0, size)


def grow_patch(patch, count, seed, uv_scale=1.0):
    """Stamped, never tiled -- a mirror-tiled patch prints an argyle lattice
    within one look.  Random position, scale, rotation and flip, each stamp
    faded through a cosine window, overlaps averaged."""
    rng = np.random.default_rng(seed)
    total = np.zeros((H, W))
    weight = np.zeros((H, W))
    for _ in range(count):
        tile = patch
        if rng.random() < 0.5:
            tile = tile[:, ::-1]
        if rng.random() < 0.5:
            tile = tile[::-1, :]
        if rng.random() < 0.5:
            tile = tile.T
        angle = rng.uniform(0, 360)
        # Rotate a validity mask with the tile.
        #
        # `reshape=True` pads the corners of the rotated square, and whatever
        # fills them is not surface: `mode="nearest"` smears the edge pixels
        # outward into hard radial wedges, which is exactly the shard-shaped
        # debris the first build of Ryugu's map was covered in -- worst on the
        # smallest patches, because there the corners are a large fraction of
        # the tile. Filling with neutral grey instead and carrying a rotated
        # mask into the blending weight means the padding contributes
        # *nothing* rather than contributing a streak.
        valid = ndimage.rotate(np.ones_like(tile), angle, reshape=True,
                               order=1, mode="constant", cval=0.0)
        tile = ndimage.rotate(tile, angle, reshape=True,
                              order=1, mode="constant", cval=1.0)
        scale = rng.uniform(0.45, 1.25) * uv_scale
        th = max(8, int(tile.shape[0] * scale))
        tw = max(8, int(tile.shape[1] * scale))
        resize = lambda a, lo, hi: np.asarray(
            Image.fromarray((np.clip(a, lo, hi) * 127).astype(np.uint8))
            .resize((tw, th), Image.BILINEAR)
        ).astype(np.float64) / 127
        tile = resize(tile, 0, 2)
        valid = np.clip(resize(valid, 0, 1), 0, 1) ** 1.5
        wy = 0.5 - 0.5 * np.cos(2 * np.pi * (np.arange(th) + 0.5) / th)
        wx = 0.5 - 0.5 * np.cos(2 * np.pi * (np.arange(tw) + 0.5) / tw)
        win = np.outer(wy, wx) * valid + 1e-4
        y0 = int(rng.integers(-th, H))
        x0 = int(rng.integers(0, W))
        ys = np.arange(y0, y0 + th)
        keep = (ys >= 0) & (ys < H)
        if not keep.any():
            continue
        xs = (np.arange(x0, x0 + tw) % W)
        sub = np.ix_(ys[keep], xs)
        total[sub] += tile[keep] * win[keep]
        weight[sub] += win[keep]
    grown = total / np.maximum(weight, 1e-6)
    # Anywhere the stamps never reached is not surface, and leaving it at a
    # flat 1.0 punches a smooth grey hole through the map -- visible as blobs
    # on the first build of Ryugu, whose patch was only 55 px and so covered
    # the least ground per stamp. `stamp_count` below now scales with patch
    # area so this should never fire; when it does, the gap borrows its
    # nearest covered neighbour rather than inventing a flat one.
    bare = weight < 1e-3
    if bare.any():
        idx = ndimage.distance_transform_edt(bare, return_distances=False,
                                             return_indices=True)
        grown = grown[tuple(idx)]
    return grown


def apply_features(field, features, seed):
    """
    The large-scale structure that is actually known, laid back on top.

    Stamping produces a plausible surface and a uniform one: it has the right
    grain everywhere and no geography anywhere.  These are the features
    published for each body -- an equatorial ridge, a named crater, a smooth
    regolith pond -- put back as multiplicative factors with noise-roughened
    edges, so they read as terrain rather than as decals.  Everything here has
    a citation in the BODIES table; nothing invented goes in.
    """
    for kind, p in features:
        if kind == "band":
            wobble = sphere_noise(3.1, seed + 11) * p["width"] * 0.45
            d = np.abs(LAT - p["lat"] + wobble)
            mask = 1 - smoothstep(p["width"] * 0.45, p["width"], d)
        elif kind in ("spot", "smooth"):
            d = angular_distance(p["lat"], p["lon"])
            # Two scales of warp, not one. A single low-frequency wobble on a
            # circle still reads as a circle; adding a finer one gives the
            # edge the ragged, lobed outline these features actually have.
            rough = (sphere_noise(2.6, seed + 23) * p["radius"] * 0.55
                     + sphere_noise(7.0, seed + 29) * p["radius"] * 0.28)
            mask = 1 - smoothstep(p["radius"] * 0.45, p["radius"], d + rough)
        else:
            continue

        if kind == "smooth":
            # A regolith pond is not a brighter patch, it is a *finer* one:
            # the grain in it is below the resolution of anything that made
            # it. But blurring it to nothing and lifting it made a bald grey
            # disc -- reported, correctly, as Itokawa having "bald ness". A
            # pond of gravel is still gravel: the coarse structure goes, the
            # fine structure stays, and the edge is not a circle.
            blurred = ndimage.gaussian_filter(field, p["blur"], mode="wrap")
            # Keep a third of the coarse relief rather than none of it, and
            # put a finer grain on top at an amplitude that can be seen
            # against the surrounding contrast. Blurring to nothing and
            # adding 7% noise left a disc that was still, unmistakably, bald.
            relief = field / np.maximum(blurred, 1e-3)
            # `keep` and `fines` default to the values every other body was
            # built with, so only a body that sets them (Itokawa) changes.
            softened = blurred * (1.0 + (relief - 1.0) * p.get("keep", 0.34))
            fine_gain = p.get("fines", 1.0)
            fines = (1.0 + sphere_noise(34.0, seed + 41, octaves=2) * 0.15 * fine_gain
                         + sphere_noise(70.0, seed + 47, octaves=2) * 0.09 * fine_gain)
            field = field * (1 - mask) + softened * fines * mask
            field = field * (1 + mask * p["gain"] * 0.55)
        else:
            field = field * (1 + mask * p["gain"])
            rim = p.get("rim", 0.0)
            if rim:
                # A crater has a raised rim, and the rim is usually the
                # brightest thing about it -- freshly turned material.
                ring = mask * (1 - mask) * 4.0
                field = field * (1 + ring * rim)
    return field



def _window(lat0, lon0, radius_deg, pad=1.35):
    """Pixel window around a point, wide enough to hold a feature of that
    angular radius. Evaluating the whole 1024x512 map for every one of three
    hundred craters is 157 million distance calculations per body; evaluating
    a 60x60 window is four orders of magnitude less."""
    span = radius_deg * pad
    j0 = int(np.clip((90 - (lat0 + span)) / 180 * H, 0, H - 1))
    j1 = int(np.clip((90 - (lat0 - span)) / 180 * H + 1, 1, H))
    # A degree of longitude is 1/cos(lat) times as wide in map pixels.
    widen = span / max(np.cos(np.radians(min(abs(lat0) + span, 89.0))), 0.02)
    half = int(np.clip(widen / 360 * W + 2, 2, W // 2))
    i0 = int(round((lon0 + 180) / 360 * W))
    return j0, j1, i0, half


def _apply_window(field, lat0, lon0, radius_deg, fn):
    """Evaluate `fn(normalised_distance)` inside the window and multiply it in,
    wrapping in longitude."""
    j0, j1, i0, half = _window(lat0, lon0, radius_deg)
    if j1 <= j0:
        return
    cols = (np.arange(i0 - half, i0 + half + 1) % W)
    lat = LAT[j0:j1, 0][:, None]
    lon = (-180 + (cols + 0.5) * 360 / W)[None, :]
    la, lo = np.radians(lat), np.radians(lon)
    la0, lo0 = np.radians(lat0), np.radians(lon0)
    cosd = np.sin(la) * np.sin(la0) + np.cos(la) * np.cos(la0) * np.cos(lo - lo0)
    d = np.degrees(np.arccos(np.clip(cosd, -1, 1))) / radius_deg
    gain = fn(d)
    sub = field[j0:j1][:, cols]
    field[j0:j1, cols] = sub * gain


def stamp_craters(field, count, seed, size_deg=(1.2, 9.0), depth=0.16, slope=2.4):
    """
    A crater field, as albedo rather than as baked shading.

    Stamped relief is what a surface is made of; craters are what makes it a
    *world*. The grown patch has the right grain everywhere and no structure
    at any scale above the patch, which is why the first build read as one
    generic rock wearing fifteen names.

    These are deliberately not shaded. The renderer lights these bodies from
    the real Sun and bakes nothing, so a crater with its shadow painted in
    would be lit from two directions at once and would swing the wrong way as
    the body turned. What is baked is what a crater does to *reflectance*: a
    floor of settled fines that is darker than its surroundings, and a rim of
    freshly turned, less space-weathered material that is brighter. That is
    the contrast every close-range image of these bodies actually shows, and
    it is correct from any lighting angle.

    Diameters follow a power law with slope 2.4, which is the observed
    production function for small-body surfaces (Melosh 1989); a linear
    distribution puts far too many large craters on and reads as golf balls.
    """
    rng = np.random.default_rng(seed)
    lo, hi = size_deg
    for _ in range(count):
        # Inverse-transform sample of dN/dD ~ D^-slope.
        u = rng.random()
        r = (lo ** (1 - slope) + u * (hi ** (1 - slope) - lo ** (1 - slope))) ** (1 / (1 - slope))
        # Uniform on the sphere, not on the map -- otherwise the poles crowd.
        lat0 = np.degrees(np.arcsin(rng.uniform(-1, 1)))
        lon0 = rng.uniform(-180, 180)
        d_floor = depth * rng.uniform(0.55, 1.35)
        rim = d_floor * rng.uniform(0.35, 0.75)

        def profile(d, d_floor=d_floor, rim=rim):
            floor = 1.0 - d_floor * (1 - smoothstep(0.55, 0.95, d))
            crest = 1.0 + rim * (smoothstep(0.72, 0.95, d) * (1 - smoothstep(0.95, 1.25, d)))
            return np.clip(floor * crest, 0.35, 1.9)

        _apply_window(field, lat0, lon0, r * 1.3, profile)
    return field


def stamp_boulders(field, count, seed, size_deg=(0.16, 0.9), gain=0.30):
    """
    Loose blocks, which on a rubble pile are most of what there is to see.

    Bennu, Ryugu, Itokawa and Dimorphos are not cratered rock, they are piles
    of gravel: the boulders are the terrain and the craters are incidental.
    Each is a small bright cap -- freshly exposed, unweathered -- with a
    slightly darker collar where fines have banked against it. Again albedo
    only, for the same reason the craters are.
    """
    rng = np.random.default_rng(seed)
    lo, hi = size_deg
    for _ in range(count):
        u = rng.random()
        r = (lo ** -1.5 + u * (hi ** -1.5 - lo ** -1.5)) ** (-1 / 1.5)
        lat0 = np.degrees(np.arcsin(rng.uniform(-1, 1)))
        lon0 = rng.uniform(-180, 180)
        g = gain * rng.uniform(0.5, 1.4)

        def profile(d, g=g):
            cap = 1.0 + g * (1 - smoothstep(0.35, 0.85, d))
            collar = 1.0 - g * 0.45 * (smoothstep(0.75, 1.0, d) * (1 - smoothstep(1.0, 1.4, d)))
            return np.clip(cap * collar, 0.35, 2.2)

        _apply_window(field, lat0, lon0, r * 1.4, profile)
    return field


def equalise_resolution(img, base_deg=0.55):
    """Blur along longitude by a kernel constant in *arc*, so a feature
    subtends the same angle at the pole as at the equator.  Without it the
    caps detonate into a pinwheel the moment a camera looks down on them."""
    h, w = img.shape
    lat = np.radians(np.linspace(90, -90, h))
    # In pixels, but derived from an *angle*, so it is the same blur on a
    # 512-wide map as on a 1024-wide one. The old floor of 3 px was three
    # times too strong at half size, which is part of why the Rank 2 maps
    # came out softer and flatter than the Rank 1 ones.
    base = max(1, int(round(base_deg / 360.0 * w)))
    triple = np.concatenate([img, img, img], axis=1)
    cs = np.concatenate([np.zeros((h, 1)), np.cumsum(triple, axis=1)], axis=1)
    idx = np.arange(w) + w
    out = np.empty_like(img)
    for j in range(h):
        half = int(np.clip(base / max(np.cos(lat[j]), 1e-3), base, w) // 2)
        out[j] = (cs[j, idx + half + 1] - cs[j, idx - half]) / (2 * half + 1)
    return out


def close_the_poles(img, contrast):
    """
    Converge the caps without ironing them flat.

    A function continuous on a sphere has to become a single value at the
    pole, and the dwarf pipeline gets there by walking each parallel towards
    its own mean from forty degrees up.  That is right for a *colour* map,
    where the thing being suppressed is large regional tone.  It is wrong
    here, because this map has no regional tone: it is a multiplicative
    detail field whose mean is one everywhere, so walking it towards its row
    mean walks it towards a flat grey lid -- measured as two washed-out bands
    covering the top and bottom fifth of the first build.

    What actually causes the pinwheel is longitudinal *structure*, and
    `equalise_resolution` has already removed that by blurring in constant
    arc.  So the convergence here is confined to the last twelve degrees,
    where the geometry genuinely demands it, and isotropic sphere grain goes
    straight back on at the map's own contrast -- so the cap has the same
    roughness as the equator and simply stops carrying features.
    """
    lat = np.abs(np.linspace(90, -90, img.shape[0]))[:, None]
    p = smoothstep(78.0, 90.0, lat) ** 1.4
    # Same again: seven rows is a different angle at 256 rows than at 512.
    sigma = max(2.0, 7.0 * img.shape[0] / 512.0)
    rows = ndimage.gaussian_filter1d(img.mean(axis=1), sigma, mode="nearest")[:, None]
    out = img * (1 - p) + rows * p
    grain = (sphere_noise(16.0, 137) * 0.62 + sphere_noise(44.0, 211, octaves=2) * 0.38)
    return out * (1 + grain * contrast * p)


def srgb_to_linear(x):
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


# --------------------------------------------------------------------------

def photographed_root(name):
    """Follow `analogue` until a body with a real photograph is reached.

    Mathilde borrows from Bennu, and Interamnia borrows from Mathilde -- so
    resolving one link is not enough. Chains are short and the catalogue is
    hand-written, but a cycle would hang the build, so it is bounded."""
    seen = set()
    while BODIES[name].get("analogue"):
        if name in seen:
            raise ValueError(f"analogue cycle at {name}")
        seen.add(name)
        name = BODIES[name]["analogue"]
    return name


def build(name, spec, cache):
    src_name = photographed_root(name)
    if src_name not in cache:
        source = BODIES[src_name]["source"]
        cache[src_name] = relief_from(
            source,
            BODIES[src_name].get("detail", 1.2),
            representative=BODIES[src_name].get("representative", False),
            window=BODIES[src_name].get("window"),
        )
    patch, where = cache[src_name]
    if spec.get("detail") and spec.get("analogue"):
        # A borrowed patch is re-contrasted for the borrower: Dimorphos is all
        # loose boulders and Halley's crust is smoother than 67P's lobes.
        patch = np.clip(1.0 + (patch - 1.0) * (spec["detail"] / BODIES[src_name]["detail"]),
                        0.40, 2.0)
        patch = patch / patch.mean()

    # Enough stamps to cover the map several times over, scaled by how much
    # ground one stamp covers. A fixed count starves a small patch and wastes
    # time on a large one; overlap costs nothing here because the contrast is
    # restored below anyway.
    #
    # A stamp has to cover the same *angle* of the body whatever the map size.
    #
    # This is the bug that made the eleven Rank 2 worlds look like clouds
    # rather than rock. Their maps are 512 wide; the patch is still 150 px of
    # the original photograph; so each stamp covered 11-31% of the map width
    # instead of the 6-16% it covers on a 1024-wide map. Twice the angular
    # size, which is the difference between grain you read as regolith and
    # blotches you read as weather. Reported exactly that way -- Object A has
    # fine even grain, Object B has soft black-and-white patches -- and the
    # two sets differ in nothing else but this.
    #
    # `grain` is a per-body multiplier on top of it, so two bodies that
    # borrow the same analogue do not come out identical.
    uv_scale = (W / 1024.0) * float(spec.get("grain", 1.0))
    side = patch.shape[0] * 0.85 * uv_scale
    stamp_count = int(np.clip(6.0 * W * H / max(side * side, 1.0),
                              spec.get("stamps", 600), 5200))
    field = grow_patch(patch, stamp_count, spec.get("seed", 7), uv_scale)

    # Stamping averages, and averaging flattens.
    #
    # Every map pixel ends up under a dozen or more overlapping stamps, and
    # the mean of a dozen independent samples of a rough surface is a much
    # smoother surface -- measured at a quarter of the contrast the patch went
    # in with, which on screen is no texture at all.  The *structure* survives
    # the averaging; only its amplitude does not.  So the deviations are
    # scaled back up until the map has the same contrast as the piece of real
    # surface it was grown from.  This restores a measured quantity rather
    # than inventing one: the target is the photograph's own.
    field = field / field.mean()
    target = float(patch.std() / patch.mean())
    #
    # A ceiling on how much contrast a map may carry.
    #
    # The target is the photograph's own, which is right in principle and
    # wrong for a source shot with hard shadows: 67P's NAVCAM frames and the
    # Giotto-analogue material come in at 0.47, and a map that contrasty on a
    # body whose *mesh* already carries craters reads as dirt rather than
    # relief -- "mixture of black white spots". The geometry is doing the
    # topography; the map only has to tint it.
    cap = spec.get("contrastCap")
    if cap:
        target = min(target, float(cap))
    current = float(field.std())
    if current > 1e-4:
        field = np.clip(1.0 + (field - 1.0) * (target / current), 0.22, 2.4)

    # Broad tonal variation, across three scales rather than two. This part
    # is invented and says so: no map of any of these bodies exists at this
    # scale. But a single octave of it is what made every body read as the
    # same material -- real surfaces vary regionally, and a texture that is
    # statistically identical everywhere looks like a sample swatch.
    seed = spec.get("seed", 7)
    field = field * (1.0 + sphere_noise(1.6, seed + 3) * 0.13
                         + sphere_noise(4.4, seed + 5, octaves=2) * 0.075
                         + sphere_noise(11.0, seed + 9, octaves=2) * 0.040)

    # Then the things that make a rock a rock rather than a noise field.
    craters = spec.get("craters")
    if craters and craters[0]:
        field = stamp_craters(field, craters[0], seed + 61,
                              size_deg=craters[1], depth=craters[2])
    boulders = spec.get("boulders")
    if boulders and boulders[0]:
        field = stamp_boulders(field, boulders[0], seed + 83,
                               size_deg=boulders[1], gain=boulders[2])

    field = apply_features(field, spec.get("features", []), seed)
    field = equalise_resolution(field)
    field = close_the_poles(field, target)

    # Centre on mid-grey and clamp.  The map carries *variation* only: the
    # body's measured albedo and its measured colour stay where they already
    # are, on the vertex colours, so nothing here can overwrite them.
    field = field / field.mean()
    out = np.clip(0.5 * field, 0.04, 1.0)

    rgb = np.repeat(out[..., None], 3, axis=2)
    pil = Image.fromarray((rgb * 255).astype(np.uint8))
    pil = pil.filter(ImageFilter.UnsharpMask(radius=2, percent=55, threshold=2))
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{name}.jpg")
    pil.save(path, quality=90, optimize=True)

    # What the renderer needs: the mean of the *saved* file after sRGB decode.
    # three.js multiplies the vertex colour by this texture, so the body would
    # come out darker by exactly this factor unless it is divided back out.
    saved = np.asarray(Image.open(path).convert("RGB")).astype(np.float64) / 255
    mean_linear = float(srgb_to_linear(saved @ [0.2126, 0.7152, 0.0722]).mean())
    kb = os.path.getsize(path) / 1024
    print(f"{name:11s} meanLinear={mean_linear:.4f}  "
          f"contrast={out.std() / out.mean():.3f} (patch {target:.3f})  "
          f"{stamp_count:4d} stamps  {kb:5.0f} kB  "
          f"{'borrowed from ' + src_name if spec.get('analogue') else 'patch at ' + str(where)}")
    return mean_linear


def main():
    """Build every map, or only the ones named on the command line.

    Adding four bodies used to mean rebuilding thirty-two, which is about
    four minutes of stamping to produce twenty-eight files byte-identical to
    the ones already on disk. `python build-small-body-textures.py chariklo
    chiron` builds those two. The printed mean-linear block then covers only
    what was built, which is what you want to paste.
    """
    wanted = set(sys.argv[1:])
    unknown = wanted - set(BODIES)
    if unknown:
        raise SystemExit("unknown body: " + ", ".join(sorted(unknown)))
    means = {}
    # Grouped by output size: the patch cache holds arrays that are only
    # valid for one map geometry, and re-deriving a patch is cheap anyway.
    for size in sorted({spec.get("size", (1024, 512)) for spec in BODIES.values()},
                       reverse=True):
        set_size(*size)
        cache = {}
        for name, spec in BODIES.items():
            if spec.get("size", (1024, 512)) != size:
                continue
            if wanted and name not in wanted:
                continue
            means[name] = round(build(name, spec, cache), 4)
    print("\nPaste into smallBodies.js:")
    print(json.dumps(means, indent=2))


if __name__ == "__main__":
    main()
