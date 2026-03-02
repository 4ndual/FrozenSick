# Context Document — Agent 2: Meta Removal

This document is injected alongside the meta-removal system prompt. It contains all reference material the classifier needs for distinguishing in-game content from out-of-game chatter.

---

## Player-to-Character Mapping

Any occurrence of these real names is OUT-OF-GAME meta-talk:

| Real Name | Variants | Character | Notes |
|-----------|----------|-----------|-------|
| **Frank** | Franklin | — (DM) | Dungeon Master. When Frank speaks AS the DM narrating, that's CANON. When players address him as "Frank," the name usage is META. |
| **Andrés** | Andual | **Tidus** | Player. "Andrés qué quieres hacer?" = MIXED (name is meta, question is canon). |
| **Selene** | — | **Nixira** | Player. |
| **Morty** | morfi, Johan, Johan9088 | **Zacarías** | Player. "morfi" is a speech-to-text garble of Morty. |
| **Dani** | — | Unknown | Appears in transcripts addressing a player or the DM. Any usage is META. |

### Rule for DM addressing players by real name

When the DM uses a real name to prompt a turn, classify as MIXED:
- `{META: Andrés,}` `[CANON] qué quieres hacer?`
- The turn prompt itself is canon (it structures the game). The real name is meta.

---

## Non-Characters (Always META)

These names refer to real-world entities, not in-game characters:

| Name | What It Actually Is | Why It Appears |
|------|-------------------|----------------|
| **Anakin** | The DM's cat | Cat interrupts sessions — scratching doors, meowing |
| **Jenny** | Gemini AI | Used out-of-game to generate session recaps |
| **Hocico** | A player's cat | Pet interruption |

If any of these names appear, the surrounding context is almost certainly META.

---

## Meta-Signal Patterns

### Category 1: Physical World References

Anything referencing the real-world environment where the players are sitting:

| Signal | Example |
|--------|---------|
| Computer/phone | "el computador", "el celular", "segunda pestaña", "navegador" |
| Stationery | "el lápiz", "el cuaderno de tapa roja", "lapicero" |
| Dice as physical objects | "Pásame los dados", "Quién tiene los dados de 20?", "Se me perdió lo blanco", "Préstame una pirámide" |
| Charger/battery | "no es mi cargador", "es el de Frank", "71%", "teléfono de muerte" |
| Food/drink (real) | "la cafetera", references to real snacks |
| Furniture/seating | "Cambiamos de puesto", "justo detrás tuyo", "al lado de mi computador" |
| Recording equipment | "parar la grabación", "la grabación" |

**Contrast with canon:** When characters in-game drink potions, eat rations, or use in-game tables, that's CANON. The distinction is whether the object exists in the fantasy world or the real world.

### Category 2: Real-World Media References

| Signal | Example |
|--------|---------|
| Music | "Linkin Park", "Dark Souls" (soundtrack reference), named real songs |
| Video games | "Free Fire", "Dark Souls" |
| Movies/shows | "Barbie", specific film references |
| YouTube | "viendo un video sobre dragones de mitología" |
| Memes/internet culture | References to real-world memes or internet slang about the game |

**Contrast with canon:** In-character musical performances (Nixira's bardic songs) are CANON. References to real bands are META.

### Category 3: Table Banter & Jokes About the Game

| Signal | Example |
|--------|---------|
| Naming arguments | "Fue tu culpa. Tú decidiste ponerle esos nombres?" |
| Rule debates | "Yo no inventé las reglas", "No pienses por favor" |
| Player commentary on luck | "Quiero morir" (after a bad roll, out of character) |
| Cross-player teasing | "A tu mamá", teasing about dice rolls |
| Meta-game commentary | "Siempre hay que llevarlo con humor" |
| Breaking the fourth wall | "Cómo ve Frank?" (addressing the DM about game design) |

**Contrast with canon:** In-character humor (Vicious Mockery insults, character banter) is CANON. Humor ABOUT the game is META.

### Category 4: Logistics & Session Management

| Signal | Example |
|--------|---------|
| Dice sharing | "Quién tiene los dados?", "Pásale todos" |
| Turn tracking | "No he hecho nada" (player tracking actions, not character statement) |
| Session timing | "Ya pasó suficiente para parar la grabación?" |
| Character sheet references | "la hoja de morfi", "mi hoja" |
| Experience tracking | "experiencia dividida entre todos" when discussed as game rule |

### Category 5: Colombian/Regional Slang (CONTEXT-DEPENDENT)

Some slang is used both in-character and out-of-character:
- "marica" — Can be in-character exclamation OR out-of-game address. Check if surrounded by canon or meta.
- "gonorreo" — Usually emotion, could be either. Default to CANON unless clearly table-talk.
- "hijueputa" — Same rule: default CANON unless clearly meta.

---

## Edge Cases — Decision Guide

| Situation | Classification | Reasoning |
|-----------|---------------|-----------|
| DM explains a rule that affects gameplay | CANON | The rule shapes what happens in the story |
| Players argue about a rule interpretation | META | The argument is about the game, not the story |
| A player says a dice result number ("17!") | CANON | The number determines what happens |
| A player complains about dice results ("Quiero morir") | META if dramatic; CANON if in-character despair | Use tone and context |
| DM references the map layout ("Hazte cuenta que esta pared...") | CANON | It describes the game world, even if using a physical map |
| Someone mentions a phone buzzing | META | Real-world device |
| DM says "listo" between turns | CANON | Turn transition marker |
| A player asks "Puedo hacer X?" about rules | MIXED | The question is meta but the answer affects canon |
| "Próximamente..." used as DM foreshadowing | CANON | Narrative tool |
| "Próximamente..." used about real-world plans | META | Session scheduling |
