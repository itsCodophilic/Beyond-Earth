# The deep-sky speech files — which paragraph goes with which event

Round 88. The deep-sky speech is plain text in four files in the project folder, `speech-forDeep-sky-1.txt` to `-4.txt`, each under ElevenLabs' 10,000-character limit: one paragraph per event, written to be read aloud: numbers are spelt the way she says them. It runs to about 5,100 words, roughly 36 minutes of narration.

**Recording.** One recording per file:

- `speech-forDeep-sky-1.txt`: paragraphs 1–13, what a nova is and the nine kinds of nova (9,363 characters)
- `speech-forDeep-sky-2.txt`: paragraphs 14–25, the twelve redesigned events (9,696 characters)
- `speech-forDeep-sky-3.txt`: paragraphs 26–33, wormhole to Kepler-186f (5,817 characters)
- `speech-forDeep-sky-4.txt`: paragraphs 34–40, Heart Nebula to the Pillars of Creation (4,407 characters)

Then each paragraph's start and end time goes into `src/js/audio/narrationCuts.js` as `"event:<id>": ["<recording>", start, end]`. Every deep-sky event declares a 60-second duration, and the runner fits it to her line (from 0.6× to 2.6×, so 36 to 156 seconds). Each paragraph is about 40 to 75 seconds.

**Recorded and wired (round 89).** `public/audio/speech-forDeep-sky-1.mp3` to `-4.mp3` are cut by paragraph in `narrationCuts.js`, so every deep-sky event now plays her line and runs as long as it. The paste copies are in `docs/voice3-text/`. The old round-79 deep-sky lines (Part 3L-5) and the old supernova and kilonova lines (Part 3F-3) are no longer used.

**The four opening paragraphs** explain what a nova, a supernova and a kilonova are. They open the classical-nova event, the first of the nova family: its cut runs from the start of file 1 to the end of paragraph 5 (172 s), and the event's design length is 70 s so it stretches to fit.

| # | File | Event id | Words | Starts |
|---|---|---|---|---|
| 1 | -1 | `classical-nova (opening)` | 63 | What is a nova? The word is Latin for new. For thousands of years, peo… |
| 2 | -1 | `classical-nova (opening)` | 98 | A true nova happens on a white dwarf, the small, dense, Earth-sized co… |
| 3 | -1 | `classical-nova (opening)` | 63 | A supernova is something far bigger. Super means it destroys the whole… |
| 4 | -1 | `classical-nova (opening)` | 86 | And a kilonova is the flash when two neutron stars, the crushed cores … |
| 5 | -1 | `classical-nova` | 154 | In August nineteen seventy-five, a new star appeared in the constellat… |
| 6 | -1 | `recurrent-nova` | 152 | Some novae do not wait thousands of years between eruptions. RS Ophiuc… |
| 7 | -1 | `micronova` | 117 | In twenty twenty-two, astronomers using NASA's TESS satellite found so… |
| 8 | -1 | `symbiotic-nova` | 134 | Some novae are in no hurry at all. In nineteen forty-four, a red giant… |
| 9 | -1 | `type-ia-supernova` | 178 | On the eleventh of November fifteen seventy-two, the Danish astronomer… |
| 10 | -1 | `supernova` | 155 | Around the year sixteen seventy, the light of a supernova reached Eart… |
| 11 | -1 | `kilonova` | 146 | On the seventeenth of August twenty seventeen, detectors in the United… |
| 12 | -1 | `hypernova` | 148 | On the twenty-fifth of April nineteen ninety-eight, a satellite caught… |
| 13 | -1 | `luminous-red-nova` | 150 | In January two thousand and two, a faint star in Monoceros suddenly br… |
| 14 | -2 | `crab-supernova` | 143 | On the fourth of July ten fifty-four, astronomers in China recorded a … |
| 15 | -2 | `sn-1987a` | 153 | On the twenty-third of February nineteen eighty-seven, deep undergroun… |
| 16 | -2 | `magnetar-flare` | 138 | On the twenty-seventh of December twenty-oh-four, a flash of gamma ray… |
| 17 | -2 | `gw150914` | 136 | On the fourteenth of September twenty fifteen, both LIGO detectors, th… |
| 18 | -2 | `proxima-superflare` | 145 | Our nearest star after the Sun is Proxima Centauri, four point two fou… |
| 19 | -2 | `betelgeuse-dimming` | 166 | Betelgeuse, the red star at Orion's shoulder, is one of the biggest st… |
| 20 | -2 | `t-crb-nova` | 127 | Beside the Northern Crown, between the bright stars Arcturus and Vega,… |
| 21 | -2 | `grb-boat` | 126 | On the ninth of October twenty twenty-two, the brightest burst of gamm… |
| 22 | -2 | `tidal-disruption` | 131 | In September twenty nineteen, a sky survey saw the centre of a galaxy … |
| 23 | -2 | `sgr-a-flares` | 152 | Toward the constellation of Sagittarius, behind thick clouds of dust, … |
| 24 | -2 | `fast-radio-bursts` | 139 | Radio telescopes sometimes catch flashes that last just a thousandth o… |
| 25 | -2 | `milky-way-andromeda` | 138 | On a dark night, in the constellation of Andromeda, you can see a fain… |
| 26 | -3 | `wormhole` | 130 | Could there be shortcuts through space? Einstein's theory says that ma… |
| 27 | -3 | `biggest-black-hole` | 124 | In the constellation of Canes Venatici is a faint blue dot of light th… |
| 28 | -3 | `white-hole` | 128 | A black hole is a place nothing can leave. Einstein's equations work j… |
| 29 | -3 | `biggest-star` | 131 | How big can a star be? Among the largest known is Stephenson two dash … |
| 30 | -3 | `dyson-sphere` | 143 | In nineteen sixty, the physicist Freeman Dyson suggested that a very a… |
| 31 | -3 | `bootes-void` | 95 | Galaxies are not scattered evenly through space. Over billions of year… |
| 32 | -3 | `pulsar` | 132 | In November nineteen sixty-seven, a young astronomer at Cambridge, Joc… |
| 33 | -3 | `kepler-186f` | 136 | In April twenty fourteen, astronomers announced the first planet found… |
| 34 | -4 | `heart-nebula` | 90 | In the constellation of Cassiopeia, long-exposure photographs show a g… |
| 35 | -4 | `galaxy-types` | 114 | Every faint smudge in a deep photograph may be a whole galaxy. In nine… |
| 36 | -4 | `j1407b-rings` | 113 | In two thousand and seven, a young star in Centaurus called J fourteen… |
| 37 | -4 | `horsehead-nebula` | 110 | Just below Orion's Belt, beside the star Alnitak, is one of the most f… |
| 38 | -4 | `rogue-planet` | 129 | In twenty thirteen, the Pan-STARRS telescope in Hawaii found a faint r… |
| 39 | -4 | `eta-carinae` | 120 | In March eighteen forty-three, a star in the southern constellation of… |
| 40 | -4 | `pillars-of-creation` | 90 | In nineteen ninety-five, the Hubble Space Telescope photographed three… |
