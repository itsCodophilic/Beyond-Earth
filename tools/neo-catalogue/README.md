# Near-Earth asteroid catalogue

Builds `public/assets/data/near-earth-asteroids.json`: every near-Earth asteroid the scene draws as a stamped rock (`src/js/scene/smallBodies/nearEarthSwarm.js`).

## 1. Download from JPL in a browser

Save each link as a file in `webresponse/` (Cmd+S, "Page Source"). NASA's server refuses one request for everything, so it is split into pieces:

| File | What | Link |
|---|---|---|
| `1.json` | Atiras + Atens | `https://ssd-api.jpl.nasa.gov/sbdb_query.api?fields=full_name,pdes,class,a,e,i,om,w,ma,epoch,H,diameter,albedo,spec_B,moid,rot_per&sb-class=IEO,ATE` |
| `2.json` | Amors 0–9,999 | same fields, `&sb-class=AMO&limit=10000&limit-from=0` |
| `3.json` | Amors 10,000 on | `&sb-class=AMO&limit=10000&limit-from=10000` |
| `4.json` | Apollos 0–9,999 | `&sb-class=APO&limit=10000&limit-from=0` |
| `5.json` | Apollos 10,000–19,999 | `&sb-class=APO&limit=10000&limit-from=10000` |
| `6.json` | Apollos 20,000 on | `&sb-class=APO&limit=10000&limit-from=20000` |

Overlaps are harmless: rows are de-duplicated on `pdes`.

## 2. Build

```
node tools/neo-catalogue/build-neo-catalogue.mjs webresponse
node scripts/list-bodies.mjs     # refreshes the count in docs/bodies-to-test.md
```

## State on 10 October 2026

Files 1–5 are in: 38,422 rows (Atira 38, Aten 3,477, Apollo 20,000, Amor 14,907). `6.json`, the last 4,290 Apollos, returned NASA server errors on the day.
