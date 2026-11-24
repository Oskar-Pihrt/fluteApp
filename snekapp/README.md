# snekapp 🐍

Deník péče o hady — něco jako Reptile Buddy, jen pro hady. Mobilní web (PWA-ready), česky i anglicky, všechna data zůstávají v zařízení (IndexedDB).

## Co umí

- **Hadi** – profil (druh, morfa, pohlaví, věk, fotka, barva), vygenerovaná ilustrace, pokud nemáš fotku.
- **Krmení** – kořist, velikost, mražená/živá, odmítnutí; z toho se počítá termín dalšího krmení (po odmítnutí se nabízí znovu za týden).
- **Historie** – svlékání, váha, délka, úklid, voda, veterinář, léky, spáření, snůška, poznámky.
- **Růst** – grafy váhy a délky v čase.
- **Kalendář** – měsíční přehled, tečky u dnů se záznamy, plánovaná krmení a úkoly (i opakované); klepnutím na den přidáš událost nebo úkol.
- **Měření délky z fotky** – vyfotíš hada vedle pravítka, klepneš na dva body pravítka (zadáš vzdálenost v cm) a obkreslíš tělo bodem po bodu. Křivka se vyhladí (Catmull-Rom), takže zatáčky se počítají správně. Fotka s obkreslením se uloží u hada. Zoom štípnutím/kolečkem, posun tažením.
- **Průvodce druhy** – teploty, vlhkost, krmení a velikost pro 11 běžných druhů (orientační hodnoty, ne veterinární rada).
- **Záloha** – export/import do JSONu (včetně fotek), ukázková data.

Přesnost měření: hadí tělo i pravítko musí ležet ve stejné rovině a foťák mířit kolmo shora. Na testovací fotce se známými rozměry vychází délka přesně.

## Spuštění

```bash
npm install --legacy-peer-deps   # npm 10 jinak padá na peer závislostech
npm run dev                      # vývoj
npm test                         # testy (měření, kalendář, plán krmení)
npm run build                    # produkční build do dist/
```

Stack: Vue 3 + TypeScript + Vite + Tailwind 4 + Dexie.

## Další kroky

Offline service worker, nativní notifikace a Android obal (Capacitor) – zatím nejsou. Připomínky teď žijí jen v aplikaci (Domů a Kalendář).
