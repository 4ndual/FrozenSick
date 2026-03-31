export interface OrganizationMember {
  name: string;
  role: string;
  status: string;
}

export interface OrganizationRecord {
  id: string;
  name: string;
  type: string;
  base: string;
  summary: string;
  aliases?: string[];
  members: OrganizationMember[];
}

export interface OrganizationGroup {
  id: string;
  title: string;
  description: string;
  organizations: OrganizationRecord[];
}

export const worldOrganizationGroups: OrganizationGroup[] = [
  {
    id: 'major-orders',
    title: 'Major Orders and Factions',
    description:
      'Canonical organizations that currently shape the campaign through power, intelligence, music, war, or sanctuary.',
    organizations: [
      {
        id: 'la-ultima-gota',
        name: 'La ultima Gota',
        type: 'Tavern refuge and covert safehouse',
        base: 'The Dragon Scar, central DragonLand',
        summary:
          'A fortified tavern-front operated by Luney IcePeak. It serves as refuge, information node, poison kitchen, and emergency fallback for the party.',
        members: [
          { name: 'Luney IcePeak', role: 'Owner and strategist', status: 'In magical coma' },
          { name: 'Tidus', role: 'Waiter and field operative', status: 'Active' },
          { name: 'Nixira Silversong', role: 'Cook, performer, and operative', status: 'Active' },
          { name: 'Zacarias', role: 'Guard and watcher', status: 'Active' },
        ],
      },
      {
        id: 'dragonforce',
        name: 'Dragonforce',
        type: 'Royal military machine',
        base: 'DragonBorn and Crown holdings',
        summary:
          'The military arm of DragonLand. Under Dranlek, it shifted from royal defense into authoritarian enforcement and scorched-earth intimidation.',
        members: [
          { name: 'Tidus', role: 'Former member', status: 'Gone rogue' },
          { name: 'Kahel Varos "El Heraldo"', role: 'Associated insignia bearer', status: 'Dead' },
          { name: 'The Bald Enemy', role: 'Active enforcer', status: 'Dead' },
          { name: 'Red / Reto', role: 'Uses Dragonforce-style methods', status: 'Uncertain' },
        ],
      },
      {
        id: 'velo-siete-canciones',
        name: 'El Velo de las Siete Canciones',
        type: 'Musical order turned covert network',
        base: 'Distributed cells across thrones and courts',
        summary:
          'Once devoted to easing pain through music, the order was corrupted into a covert political instrument. Las Cuerdas Rotas is treated as a legacy alias of this same organization, not a separate entity.',
        aliases: ['Las Cuerdas Rotas'],
        members: [
          { name: 'Nixira Silversong', role: 'Former member', status: 'Hunted' },
          { name: 'Kaelan Thorne "La Cuerda Rota"', role: 'Corruption and betrayal axis', status: 'Active' },
          { name: 'Draxa', role: 'Field operative', status: 'Alive' },
        ],
      },
      {
        id: 'piedra-sangrante',
        name: 'La Piedra Sangrante',
        type: 'Heraldic order',
        base: 'Unknown',
        summary:
          'An order known more by insignia than by doctrine. Its symbols appear on Kahel Varos "El Heraldo", which makes its political weight relevant even if its structure remains unclear.',
        members: [{ name: 'Kahel Varos "El Heraldo"', role: 'Insignia bearer', status: 'Dead' }],
      },
      {
        id: 'era-blanca',
        name: 'Centinelas de la Era Blanca',
        type: 'Intelligence and sentinel network',
        base: 'Distributed cells and border routes',
        summary:
          'A long-memory espionage and messenger network. Their intelligence moved fast across border routes, and Kahel Varos was one of their confirmed operatives.',
        members: [
          { name: 'Kahel Varos "El Heraldo"', role: 'Confirmed operative', status: 'Dead' },
        ],
      },
      {
        id: 'orden-del-silencio',
        name: 'Orden del Silencio',
        type: 'Monastic order',
        base: 'Hidden monasteries and prison routes',
        summary:
          'A discipline-first order devoted to anonymity, training, and specialized mastery. It shapes the arc of Senor Nadie and his pupils.',
        members: [
          { name: 'Senor Nadie / Faorus Rain', role: 'Master', status: 'Alive' },
          { name: 'Rodrigo', role: 'Pupil', status: 'Dead' },
          { name: 'Fuercitas', role: 'Pupil', status: 'Alive' },
          { name: 'Fresitas', role: 'Pupil', status: 'Missing' },
        ],
      },
    ],
  },
  {
    id: 'great-houses',
    title: 'The Five Great Houses of DragonLand',
    description:
      'These are not one organization. Each house stands on its own as a political actor, and together they define the feudal structure of DragonLand.',
    organizations: [
      {
        id: 'house-gremmory',
        name: 'Casa Gremmory',
        type: 'Great House of Fire',
        base: 'Noctyra',
        summary:
          'Fire-aligned nobility tied to commerce, pressure, and influence in the western domains of DragonLand.',
        members: [
          { name: 'Tywin Gremmory', role: 'Current house leader', status: 'Active' },
          { name: 'Torin Gremmory', role: 'House champion and heir figure', status: 'Active' },
          { name: 'Vermy Gremmory', role: 'Goblin aide and local fixer', status: 'Active' },
        ],
      },
      {
        id: 'house-icepeak',
        name: 'Casa IcePeak',
        type: 'Great House of Ice',
        base: 'Valdrenor',
        summary:
          'The house of Luney, Donner, and the WinterSpeak dynasty. It maintains one of the clearest noble links to the party.',
        members: [
          { name: 'Luney IcePeak', role: 'Representative at La ultima Gota', status: 'In magical coma' },
          { name: 'Donner IcePeak', role: 'Lord of War', status: 'Alive' },
          { name: 'Blitzen IcePeak', role: 'Supreme Lord of IcePeak', status: 'Alive' },
        ],
      },
      {
        id: 'house-dragonheart',
        name: 'DragonHeart',
        type: 'Great House of Arcana',
        base: 'Kharvok',
        summary:
          'Arcane nobility with influence over the central domains, magical institutions, and the political core around the capital.',
        members: [{ name: 'House leadership', role: 'Arcane nobility', status: 'Active' }],
      },
      {
        id: 'house-deepwater',
        name: 'Casa DeepWater',
        type: 'Great House of Sea and Rivers',
        base: 'Draknor',
        summary:
          'Maritime and river power with influence over water routes, crossings, and the logistics that sustain the kingdom.',
        members: [{ name: 'House leadership', role: 'River and sea lords', status: 'Active' }],
      },
      {
        id: 'house-draksky',
        name: 'Casa Draksky',
        type: 'Great House of Air and Wind',
        base: 'Confederated territories',
        summary:
          'A looser union of lesser lords and regional rulers. Farquad belongs to this house, but his personal forces are not treated as an organization of their own.',
        members: [{ name: 'Farquad Drasky', role: 'Noble scion', status: 'Active' }],
      },
    ],
  },
];

