# snekapp 🐍

Deník péče o hady — něco jako Reptile Buddy, jen pro hady. Mobilní web a aplikace pro Android, česky i anglicky, všechna data zůstávají v zařízení (IndexedDB).

## Co umí

- **Hadi** – profil (druh, morfa, pohlaví, věk, fotka, barva), vygenerovaná ilustrace, pokud nemáš fotku.
- **Krmení** – kořist, velikost, mražená/živá, odmítnutí; z toho se počítá termín dalšího krmení (po odmítnutí se nabízí znovu za týden).
- **Historie** – svlékání, váha, délka, úklid, voda, veterinář, léky, spáření, snůška, poznámky.
- **Růst** – grafy váhy a délky v čase.
- **Kalendář** – měsíční přehled, tečky u dnů se záznamy, plánovaná krmení a úkoly (i opakované); klepnutím na den přidáš událost nebo úkol.
- **Měření délky z fotky** – vyfotíš hada vedle pravítka, klepneš na dva body pravítka (zadáš vzdálenost v cm) a obkreslíš tělo bodem po bodu. Křivka se vyhladí (Catmull-Rom), takže zatáčky se počítají správně. Fotka s obkreslením se uloží u hada. Zoom štípnutím/kolečkem, posun tažením.
- **Průvodce druhy** – teploty, vlhkost, krmení a velikost pro 11 běžných druhů (orientační hodnoty, ne veterinární rada).
- **Připomínky** (Android) – notifikace na krmení a úkoly ve zvolený čas.
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

## Android aplikace (Capacitor)

Nativní obal je ve složce `android/` (balíček `app.snekapp`, ten už neměnit – Android by ho bral jako jinou appku a data by se ztratila).

```bash
npm run android:sync   # build webu a zkopírování do android/
npm run android:open   # otevře projekt v Android Studiu (Run ▶ na telefon)
npm run android:apk    # debug APK → android/app/build/outputs/apk/debug/app-debug.apk
```

Potřebuješ JDK 21 a Android SDK (nejjednodušeji přes Android Studio).

### Připomínky

V aplikaci pro Android: **Více → Připomínky**. Po zapnutí se aplikace zeptá na povolení notifikací a pak upozorňuje:

- **na krmení** – v den, kdy hadovi vychází další krmení, ve zvolený čas (výchozí 9:00),
- **když je krmení po termínu** – jedno připomenutí další den; po každém otevření appky se naplánuje znovu,
- **na úkoly z kalendáře** – v jejich den ve zvolený čas.

Klepnutí na notifikaci otevře daného hada (nebo kalendář u úkolu). Plán se přepočítá po každé změně dat. Notifikace jsou čistě lokální, žádný server. Tlačítkem *Poslat zkušební* ověříš, že chodí.
Ve webové verzi připomínky nejsou.

## Další kroky

Offline service worker pro webovou verzi a podepsaný release build pro Google Play.
