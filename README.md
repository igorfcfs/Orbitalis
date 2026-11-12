# ORBITALIS

An interactive body map for each astronaut on a Terra to Mars cruise. It shows which body system the mission is taxing, where each number comes from, and the one thing to do today.

Built by team **AstroCoders** for the NASA Space Apps Challenge 2026, challenge *Create Health Monitoring Software for Astronauts on Space Missions*.

## What it is, and what it is not

- A prototype. It is **not a medical device** and gives **no diagnosis, drug or dose**. Actions come from a closed catalog.
- **All crew and all physiological signals are synthetic.** The four astronauts are fictional. The pre-flight genomic and epigenetic profile (RF-34) is synthetic and is never presented as a NASA exam or as data from a real astronaut.
- Status (`NOMINAL`, `WATCH`, `CRITICAL`) is computed by deterministic code in `src/engine`. AI never computes or changes a status.
- Every number carries its unit, the pre-flight baseline and a provenance seal (`CONTINUOUS`, `PERIODIC`, `ESTIMATED`, `LOGGED`, `LIVE`). Official limits show their NASA-STD-3001 requirement ID; the others are labelled *Provisional threshold*.
- Real data used: NASA DONKI space weather (live feed, with a labelled sample when offline), NASA OSDR/GeneLab study listings, and published values cited in the app (Sources screen), for example 1.8 mSv/day measured by the RAD instrument on the Mars Science Laboratory cruise.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # typecheck + production build
```

Optional AI explanations: copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`. Without a key the app is complete and shows fallback text marked `Offline explanation`. The key is read only on the server (`src/server`, `api/`), never in the browser.

Useful URL flags: `?suit=1&xray=1&solar=1&day=200&link=blackout&scenario=launch|station|lunar`.

## Deploy

The three `/api` routes (space weather, OSDR, AI explanation) run as Vite middleware in development and as Vercel Functions (`api/`) in production. Set `ANTHROPIC_API_KEY` in the project environment variables. The AI route has a per-IP rate limit that works per function instance, so also set a spend limit with the key provider.

## Use of AI

AI use is declared in `docs/ORBITALIS — AI Use Declaration.md`.

## License and credits

Original code: MIT (see `LICENSE`). Third-party material keeps its own license, listed in `public/models/ATTRIBUTION.md`, `public/assets/ATTRIBUTION.md`, the in-app Credits and the Sources screen:

- Body model data: Z-Anatomy, the libre 3D atlas of anatomy (CC BY-SA 4.0), derived from BodyParts3D, The Database Center for Life Science.
- Heads and hair: Microsoft Rocketbox (MIT). The authors describe the avatars as generic characters that depict no real person.
- EVA suit: NASA Z-2 planetary suit, NASA 3D Resources (public domain).
- Mars and Milky Way maps: Solar System Scope (CC BY 4.0, NASA/ESA data). Textures: Poly Haven (CC0).
