import type { ActionDef } from '../types'

// Catálogo fechado. Durações são ilustrativas.
export const ACTIONS: Record<string, ActionDef> = {
  'EX-RES': { id: 'EX-RES', label: 'Resistive exercise session', resource: 'ARED', protocol: 'Part of the ~2 h/day ISS exercise program', minutes: 45 },
  'EX-AER': { id: 'EX-AER', label: 'Aerobic exercise session', resource: 'T2 or CEVIS', protocol: '70–90% of maximum heart rate', minutes: 30 },
  'EX-PLAN': { id: 'EX-PLAN', label: 'Restore exercise plan adherence', resource: 'Schedule', protocol: 'ISS adherence: T2 47%, CEVIS 37% of days', minutes: 10 },
  'SLP-EXT': { id: 'SLP-EXT', label: 'Protect an 8-hour sleep window', resource: 'Crew compartment', protocol: 'Schedule block, no protocol cited', minutes: 480 },
  'SLP-LIGHT': { id: 'SLP-LIGHT', label: 'Dim cabin light before sleep', resource: 'Cabin lighting', protocol: 'No protocol cited', minutes: 5 },
  'BEH-LOAD': { id: 'BEH-LOAD', label: "Rebalance today's task load", resource: 'Planning', protocol: 'No protocol cited', minutes: 10 },
  'NUT-CAL': { id: 'NUT-CAL', label: 'Raise energy intake to 100% of need', resource: 'Pantry', protocol: 'NASA-STD-3001 [V1 4020]', minutes: 20 },
  'NUT-D': { id: 'NUT-D', label: 'Confirm vitamin D supplementation', resource: 'Supplements', protocol: '800 IU/day, ISS standard since 2006', minutes: 2 },
  'NUT-MASS': { id: 'NUT-MASS', label: 'Repeat body mass measurement', resource: 'SLAMMD', protocol: 'No protocol cited', minutes: 5 },
  'OCU-EXAM': { id: 'OCU-EXAM', label: 'Repeat eye exam and log symptoms', resource: 'OCT, fundoscope', protocol: 'No protocol cited', minutes: 20 },
  'IMM-SAMPLE': { id: 'IMM-SAMPLE', label: 'Collect a blood sample', resource: 'Bio-Analyzer', protocol: 'Result in 2–3 h', minutes: 15 },
  'RAD-SHELTER': { id: 'RAD-SHELTER', label: 'Move to the storm shelter', resource: 'Shielded area', protocol: 'Solar particle event procedure', minutes: 5 },
  'RAD-REVIEW': { id: 'RAD-REVIEW', label: 'Review remaining-mission dose budget', resource: 'Dose log', protocol: 'NASA-STD-3001 [V1 4030]', minutes: 10 },
  'CMO-CONSULT': { id: 'CMO-CONSULT', label: 'Consult the Crew Medical Officer', resource: 'CMO or backup', protocol: 'No protocol cited', minutes: 20 },
  'EARTH-PACKET': { id: 'EARTH-PACKET', label: 'Add to the flight surgeon packet', resource: 'Log', protocol: 'Sent when the link allows', minutes: 2 },
}
