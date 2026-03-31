export type TrackerCharacterFilter = 'General' | 'Nixira' | 'Tidus' | 'Zacarias';

export interface TrackerSubplotItem {
  character: TrackerCharacterFilter;
  title: string;
  summary: string;
  status: string;
  questions?: string[];
}

export const trackerCharacterFilters: TrackerCharacterFilter[] = [
  'General',
  'Nixira',
  'Tidus',
  'Zacarias',
];

export const trackerSubplots: TrackerSubplotItem[] = [
  {
    character: 'General',
    title: 'The Secret-Keepers',
    summary:
      "Each player character has an NPC who knows, or once knew, their deepest secret. Rainbow held Nixira's secret, Red held Tidus's, and Farquad Drasky still holds Zacarias's.",
    status:
      'Active threat. Rainbow and Red remain uncertain; Farquad is confirmed alive and still dangerous.',
    questions: [
      'Did Rainbow or Red pass those secrets on before disappearing?',
      'How much leverage does Farquad still hold over Zacarias?',
    ],
  },
  {
    character: 'Nixira',
    title: "The Veil's Hunt",
    summary:
      "Nixira Silversong's identity is public. El Velo de las Siete Canciones knows where she is, Draxa survived the gate fight, and Kaelan Thorne 'La Cuerda Rota' was seen alive directing operations from a silver throne.",
    status: 'Critical. The hunt is active and no longer theoretical.',
    questions: [
      'Will Draxa return before the party can regroup?',
      "Does Bixira's medallion offer any protection against the Veil?",
      "What is El Velo de las Siete Canciones preparing now that Nixira's location is confirmed?",
    ],
  },
  {
    character: 'Nixira',
    title: 'Serpent Venom Timer',
    summary:
      'Nixira was bitten by a serpent in Chapter 2. Enough time has passed that the poisoning timeline and any required cure remain unclear.',
    status: 'Active medical risk.',
    questions: [
      'Does she still need antivenom or specialized healing?',
      'Was the timeline altered by magic, travel, or missing scenes?',
    ],
  },
  {
    character: 'Nixira',
    title: 'The Dwarf Curse ("Asesina de Ninos")',
    summary:
      'A dwarf mother cursed Nixira with a facial rune after the ballista fire killed dwarven children. Draxa later exposed the mark at Brasboredon, and surviving witnesses can still spread the truth.',
    status: 'Active and exposed.',
    questions: [
      'Will Messi tell other dwarves what he saw?',
      "How will the curse affect any future IcePeak alliance?",
      "What happens when the curse collides with Zacarias's oath to protect dwarves?",
    ],
  },
  {
    character: 'Tidus',
    title: 'IcePeak Connection',
    summary:
      "Tidus forged a bond with Donner IcePeak, saved him from divine possession, and received an IcePeak favor coin redeemable with any of Donner's seven brothers.",
    status: 'Active alliance thread.',
    questions: [
      'Will the IcePeak family stand with the party now that Luney is safe?',
      'What limits does the favor coin carry?',
    ],
  },
  {
    character: 'Tidus',
    title: 'Dragonforce Recognition',
    summary:
      'Tidus recognizes Dragonforce methods and used to belong to that world. A sentinel fled toward DragonBorn carrying intelligence that may include Tidus and the party.',
    status: 'Active exposure risk.',
    questions: [
      'Has Dragonforce already identified him?',
      'Will DragonBorn treat him as an asset, a traitor, or both?',
    ],
  },
  {
    character: 'Tidus',
    title: 'Chimuelo the Wyrmling',
    summary:
      "Tidus bonded with a baby rock dragon in the caves, but Farquad's trainers carry whistles that may override that bond. Chimuelo was left near the exit, afraid of sunlight.",
    status: 'Active and unresolved.',
    questions: [
      'Can Tidus reclaim Chimuelo before someone else does?',
      'How vulnerable is the bond to outside commands?',
    ],
  },
  {
    character: 'Tidus',
    title: 'Bhaal Medallion Counter',
    summary:
      "After Borax's mercy kill, Tidus's death-god medallion activated and later absorbed divine force during the clash over Donner. The counter is advancing, and every change feels deliberate.",
    status: 'Active divine escalation.',
    questions: [
      'What exactly increments the counter?',
      'Is Bhaal preparing Tidus for a blessing, a weapon, or a curse?',
    ],
  },
  {
    character: 'Zacarias',
    title: 'The Arcane Library',
    summary:
      'A hidden chamber in the mountain caves absorbed his raven familiar and promised, "Read me, for there lies your power."',
    status: 'Active but unexplored.',
    questions: [
      'What entity spoke from the library?',
      'What power will it demand in exchange for knowledge?',
    ],
  },
  {
    character: 'Zacarias',
    title: "Malacor's Betrayal",
    summary:
      'Zacarias and Malacor were once close friends and brothers in faith. Their break shaped the current conflict, yet the truth is still buried.',
    status: 'Unresolved personal conflict.',
    questions: [
      'Did Zacarias truly hand over the Crown?',
      'Why did Malacor turn against him?',
    ],
  },
  {
    character: 'Zacarias',
    title: "Malfas's Price",
    summary:
      'His patron keeps answering with contempt and escalating costs. The blood-web shield stripped away ritual casting, and the raven has already been destroyed twice.',
    status: 'Active pact instability.',
    questions: [
      'How much more can Zacarias lose before the pact collapses?',
      'Is Malfas shaping him or discarding him?',
    ],
  },
  {
    character: 'Zacarias',
    title: 'Death, Return, and the False Prophet Mission',
    summary:
      'Zacarias died in Chapter 6 and returned after Malfas intervened in the Escritorio. His mission is now explicit: find and destroy the false prophets.',
    status: 'Active divine assignment.',
    questions: [
      'How many false prophets are left?',
      'Can completing the mission stabilize his failing patron bond?',
      'What happens if he dies again before the mission is complete?',
    ],
  },
  {
    character: 'Zacarias',
    title: 'Blood Oath to Bhaal',
    summary:
      "After the Troll battle, Zacarias swore a blood oath marked on his forearm that obligates him to protect any dwarf he encounters, creating direct tension with Nixira's curse.",
    status: 'Active and binding.',
    questions: [
      'How will the oath react when dwarf interests clash with the party?',
      'Can Bhaal punish him for failing a dwarf in need?',
    ],
  },
  {
    character: 'Zacarias',
    title: 'The Lost Hand',
    summary:
      "The stone invoker tore off Zacarias's right hand in melee. His pact remains, but the physical cost is severe for a caster who relies on gesture and ritual control.",
    status: 'Active physical consequence.',
    questions: [
      'Can the hand be restored, replaced, or pact-forged anew?',
      'Will Malfas demand a new price for compensation?',
    ],
  },
];

