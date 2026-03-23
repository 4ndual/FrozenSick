# Relations — Frozen Sick

*Last updated after Chapter 6*

---

## Party Relationships

```mermaid
graph LR
    Tidus["Tidus (Rogue / Waiter)"]
    Zacarias["Zacarías (Warlock / Guard)"]
    Nixira["Nixira (Bard / Cook)"]

    Tidus <-->|"Picón speakers, battle brothers"| Zacarias
    Tidus <-->|"mutual loyalty, she killed demon for him"| Nixira
    Zacarias <-->|"she grounds him, he protects her"| Nixira
```

---

## Enemy Network

```mermaid
graph TD
    Malacor["Malacor (The White Rat)"]
    Crown["Corona Dorada (Golden Crown)"]
    Farquad["Farquad Drasky (Casa Draksky)"]
    BaldEnemy["The Bald Enemy DEAD"]
    Red["Red / Reto — STATUS UNCERTAIN"]
    Dragonforce["Dragonforce (Military of DragonLand)"]
    ElvenTac["Elven Tactician (~Level 15)"]
    DragonTrainers["Dragon Trainers (with whistles)"]
    Borax["Borax DEAD"]
    StoneInvoker["Stone Invoker (Elementalist)"]
    Dranlek["Dranlek 'El Oscuro' (La Iguana) — CURRENT KING"]

    Dranlek -->|"commands"| Dragonforce
    Malacor -->|"wields"| Crown
    Malacor -->|"commands"| BaldEnemy
    Malacor -->|"directs"| Red
    Red -->|"uses methods of"| Dragonforce
    Red -->|"holds secret of"| TidusRef["Tidus"]
    BaldEnemy -->|"member of"| Dragonforce
    Farquad -->|"allied with / controls"| Malacor
    Farquad -->|"Casa Draksky"| CasaDraksky["Casa Draksky (Air/Wind)"]
    Farquad -->|"commands"| ElvenTac
    Farquad -->|"commands"| DragonTrainers
    Farquad -->|"holds secret of"| ZacRef["Zacarías"]
    Borax -->|"former apprentice"| Dragonforce
    StoneInvoker -->|"soldier of"| Dragonforce
```

---

## PC to NPC Connections

```mermaid
graph TD
    subgraph pcs [Player Characters]
        Tidus["Tidus"]
        Zacarias["Zacarías"]
        Nixira["Nixira"]
    end

    subgraph allies [Allies]
        Luney["Luney IcePeak (Boss DYING)"]
        Dracus["Dracus (El Manco)"]
        Nadie["Señor Nadie (Master Monk)"]
        Hook["Hook (Twin Elf)"]
        Chimuelo["Chimuelo (Rock Wyrmling)"]
        Robinson["Robinson (Companion)"]
        Bixira["Bixira (Rebel Commander)"]
    end

    subgraph enemies [Enemies]
        Malacor["Malacor"]
        Farquad["Farquad Drasky (Casa Draksky)"]
        Velo["El Velo de las Siete Canciones"]
        Keylan["Keylan"]
        Borax2["Borax DEAD"]
        StoneInv["Stone Invoker"]
        DwarfMother["Dwarf Mother"]
        Dranlek["Dranlek El Oscuro (La Iguana) — KING"]
    end

    subgraph unknown [Unknown Alignment]
        BountyHunter["Bounty Hunter"]
        MysteryWoman["Mysterious Woman (Crimson Eyes)"]
        Rainbow["Rainbow — STATUS UNCERTAIN"]
        Red2["Red — STATUS UNCERTAIN"]
    end

    Tidus -->|"employer"| Luney
    Tidus -->|"secret held by (uncertain status)"| Red2
    Tidus -->|"old companion"| Dracus
    Tidus -->|"tamed"| Chimuelo
    Tidus -->|"former member"| Dragonforce2["Dragonforce"]
    Tidus -->|"killed (mercy)"| Borax2
    Tidus -->|"Val medallion (1/20)"| Val["Val (God of Death)"]

    Zacarias -->|"employer"| Luney
    Zacarias -->|"secret held by"| Farquad
    Zacarias -->|"patron pact"| Malfas["Malfas (Prince of Ravens)"]
    Zacarias -->|"former friend / now enemy"| Malacor
    Zacarias -->|"ally"| Nadie
    Zacarias -->|"lost right hand to"| StoneInv

    Nixira -->|"employer"| Luney
    Nixira -->|"former member"| Velo
    Nixira -->|"betrayed by"| Keylan
    Nixira -->|"bitter rival; he held her secret"| Rainbow
    Nixira -->|"song for"| Rodrigo2["Rodrigo DEAD"]
    Nixira -->|"companion"| Robinson
    Nixira -->|"cursed by (asesina de niños)"| DwarfMother
    Nixira -->|"fighting alongside"| Bixira

    Luney -->|"cut wings off"| Victus2["Victus DEAD"]
    Dracus -->|"entangled with"| Malacor
```

---

## Organization Relationships

```mermaid
graph TD
    Unei["La Última Gota (The Tavern)"]
    DF["Dragonforce (Military of DragonLand)"]
    Velo["El Velo de las Siete Canciones"]
    Blanca["Centinelas de la Era Blanca"]
    Cuerdas["Las Cuerdas Rotas (Broken Strings)"]
    Piedra["La Piedra Sangrante (Bleeding Stone)"]
    MalNet["Malacor's Network"]
    FarForces["Farquad's Forces (Casa Draksky)"]
    OrdenSilencio["Orden del Silencio (Monks)"]
    Rebels["Rebel Forces"]
    Limpiadores["Los Limpiadores (Neutral)"]

    subgraph houses [Five Great Houses]
        Gremmory["Casa Gremmory (Fire/Noctyra)"]
        IcePeak["Casa IcePeak (Ice/Valdrenor)"]
        DragonHeart["DragonHeart (Arcana/Kharvok)"]
        DeepWater["Casa DeepWater (Sea/Draknor)"]
        Draksky["Casa Draksky (Air/Wind)"]
    end

    Unei -->|"run by Luney IcePeak"| IcePeak
    FarForces -->|"Farquad Drasky"| Draksky
    MalNet -->|"uses methods of"| DF
    MalNet -->|"disrupting operations of"| Blanca
    FarForces -->|"allied with"| MalNet
    Unei -->|"opposed by"| MalNet
    Unei -->|"trades with Elven suppliers"| Blanca
    Rebels -->|"fighting against"| DF
    Limpiadores ---|"neutral / respected by all"| DF
    Limpiadores ---|"neutral / respected by all"| Rebels
    Blanca -->|"Kahel Varos is operative"| KV["Kahel Varos 'El Heraldo'"]

    BH["Bounty Hunter"]
    BH -->|"affiliated"| Cuerdas
    BH -->|"wears insignia"| DF
    BH -->|"wears insignia"| Blanca
    BH -->|"wears insignia"| Piedra
```

---

## Timeline of Key Relationships

| When | Event | Relationships Formed/Broken |
|------|-------|-----------------------------|
| ~90 years ago | Southern elven tribe destroyed | Tidus loses his people; taken in by northern tribe |
| Years ago | Tidus joins Dragonforce | Tidus ↔ Dragonforce (military of DragonLand), Tidus ↔ Dragonborn royalty |
| Years ago | Tidus & Dracus run missions together | Tidus ↔ Dracus (old companions) |
| Years ago | Borax serves as castle apprentice under Tidus | Tidus ↔ Borax (superior/subordinate, envy) |
| Years ago | Zacarías & Malacor are close friends | Zacarías ↔ Malacor (brothers in faith) |
| Years ago | Zacarías loses paladin powers, pacts with Malfas | Zacarías ↔ Malfas (patron) |
| >5 years ago | Nixira flees the El Velo de las Siete Canciones | Nixira vs. Keylan, Nixira vs. Veil |
| ~2 years ago | All three PCs join the tavern | PCs ↔ Luney (employer) |
| Ch.1 | Bounty hunter arrives, chaos erupts | Red vs. PCs, Bald Enemy vs. PCs |
| Ch.1 | Nixira's identity exposed | Nixira exposed to Veil hunters |
| Ch.1 | Zacarías reveals Malacor connection | Zacarías vs. Malacor (personal vendetta) |
| Ch.2 | Dracus proposes alliance against Malacor | PCs ↔ Dracus (reluctant allies) |
| Ch.2 | Tidus tames Chimuelo | Tidus ↔ Chimuelo (dragon rider bond) |
| Ch.2 | Farquad captures the party | PCs vs. Farquad |
| Ch.3 | Zacarías allies with Señor Nadie | Zacarías ↔ Nadie (mutual respect) |
| Ch.3 | Nixira kills Victus | Nixira → Victus (mercy killing) |
| Ch.3 | Nixira dedicates kill to Zacarías | Nixira ↔ Zacarías (deepened bond) |
| Ch.6 | Tidus kills Borax (mercy kill) | Tidus → Borax (resolved rivalry), Tidus ↔ Val (god of death) |
| Ch.6 | Nixira cursed by dwarf mother | Nixira vs. Dwarves (racial stigma) |
| Ch.6 | Zacarías loses right hand to stone invoker | Zacarías vs. Stone Invoker |
| Ch.6 | Nixira allies with Robinson and Bixira | Nixira ↔ Robinson (companion), Nixira ↔ Bixira (rebel alliance) |
| Ch.6 | Party separated across Brasboredon | All PCs isolated — bonds tested by distance |
