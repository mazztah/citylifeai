# CityLife AI - Story-Bibel

## Titel
**"Das Erbe am Kröpcke"** (Arbeitstitel der Hauptkampagne)

## Prämisse
Du erbst von deiner Großtante ein halb verfallenes Mehrfamilienhaus in der
List (Hannover). Am Tag deiner Ankunft liegt bereits ein anonymes Kaufangebot
vor - jemand wollte das Haus schon vor dir haben. Die Spur führt zu sieben
Grundstücken entlang einer geplanten Trasse, einem Immobilien-Investor mit
Deckadresse und einem 40 Jahre alten Konflikt, den deine Großtante unter dem
Decknamen "M." bereits einmal gewonnen hat.

Die Kampagne verbindet bewusst die Immobilien-/Wirtschaftsmechanik des Spiels
mit der Story: jede Sanierung, jeder Taxi-Auftrag, jeder Kauf ist gleichzeitig
Fortschritt in der Wirtschaftssimulation UND ein Puzzlestück der Handlung.

## Hauptfiguren

| Figur | Rolle |
|---|---|
| **Du (Spielfigur)** | Erbin/Erbe, neu in Hannover, wächst vom Laufburschen zur Immobilienstrategin/zum -strategen |
| **Herr Voss** | Makler, Gesicht der anonymen Investorengruppe, freundlich-bedrohlich |
| **Frau Ilkin** | Nachbarin, kennt die Hausgeschichte, moralischer Kompass des Viertels |
| **"M." (Großtante)** | Nur aus Briefen/Akten bekannt, hat den Konflikt in den 1980ern schon einmal geführt |
| **Der Handwerksbetrieb im EG** | Symbol für das, was bei einem Verkauf verloren ginge |
| **Investorengruppe ("Nordfeld Development")** | Antagonist, kauft gezielt entlang der geplanten Trasse auf |

## Kapitelübersicht (Konzept für 12 Kapitel)

Kapitel 1-5 sind bereits vollständig als JSON in
`backend/app/data/story_chapters.json` ausformuliert und im Spiel spielbar.
Kapitel 6-12 sind hier als Konzept skizziert und können im selben JSON-Schema
ergänzt werden (id, order, unlock_xp, title, intro, cliffhanger, mission_chain).

1. **Ankunft am Kröpcke** *(implementiert)* - Ankunft, erstes Angebot auf der Fußmatte.
2. **Der anonyme Käufer** *(implementiert)* - Voss' Angebot, Warnung von Frau Ilkin.
3. **Die sieben Grundstücke** *(implementiert)* - Trassenplan im Keller entdeckt.
4. **M.** *(implementiert)* - Verbindung zur Großtante, Voss' Jobangebot.
5. **Die Entscheidung** *(implementiert)* - Weichenstellung Nachbarschaft vs. Investoren.
6. **Konsequenzen** *(geplant)* - Sichtbare Auswirkung der Entscheidung aus Kapitel 5
   auf `CityState` (citizen_mood/average_rent_index verschieben sich dauerhaft
   in unterschiedliche Richtungen je nach Wahl).
7. **Der Handwerksbetrieb** *(geplant)* - Nebenhandlung: der Betrieb im EG droht
   unabhängig vom Hauptkonflikt schließen zu müssen; Spieler kann durch
   Immobilien-Mechanik (Mietsenkung, Modernisierung) eingreifen.
8. **Die Ratssitzung** *(geplant)* - Öffentliche Anhörung zur Trasse im Neuen
   Rathaus; erstmals Mehrspieler-relevant (mehrere Spieler könnten künftig an
   derselben Anhörung teilnehmen, siehe ROADMAP Multiplayer).
9. **Riss im Viertel** *(geplant)* - Konflikt eskaliert, manche Nachbarn wollen
   doch verkaufen; Spieler muss vermitteln oder eigene Position stärken.
10. **Was M. wirklich tat** *(geplant)* - Volle Auflösung der Vorgeschichte der
    Großtante, inkl. moralisch zwiespältigem Detail (sie hat damals auch nicht
    nur "sauber" gewonnen).
11. **Die Übernahme** *(geplant)* - Höhepunkt: letzter Versuch der
    Investorengruppe, das eigene Grundstück zu bekommen (Sabotage, Drohungen
    oder Kaufangebot - abhängig vom bisherigen Pfad).
12. **Eine Stadt, viele Wege** *(geplant)* - Epilog, der explizit zeigt, wie
    unterschiedlich sich Hannover für unterschiedliche Spieler entwickelt hat -
    inhaltlicher Payoff der World-Evolution-Mechanik.

## Ton & Stil

- Bodenständig, keine übertriebene Action - passt zur "GTA ohne Gewalt"-Vision
  aus dem ursprünglichen Konzept.
- Reale Hannoveraner Orte werden als Kulisse ernst genommen (Kröpcke,
  Lister Meile, Eilenriede, Maschsee, Neues Rathaus), nicht nur als Label.
- Wirtschaftliche Entscheidungen sind immer auch moralische Entscheidungen
  (Miethöhe, Sanierungsstandard, wem man das Grundstück gönnt).
