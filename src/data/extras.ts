import type { MetricDef, SystemDef, SystemId } from '../types'

type MetricExtra = Pick<MetricDef, 'heritage' | 'minutes' | 'plain'>

export const EXTRA_METRIC: Record<string, MetricExtra> = {
  rhr: { heritage: 'Worn on the ISS (CSA Bio-Monitor)', minutes: 0, plain: 'How fast your heart beats at rest. In microgravity the heart works against less load, so this number shifts as the heart adapts.' },
  sbp: { heritage: 'Worn on the ISS (CSA Bio-Monitor)', minutes: 0, plain: 'The pressure in your arteries when the heart pushes. Fluid moving toward the head changes it, so the trend matters more than one reading.' },
  vo2: { heritage: 'Cycle ergometer (CEVIS) on the ISS', minutes: 20, plain: 'How much oxygen your body can use at full effort. It is your engine size, and it falls without regular aerobic work.' },
  bmd: { heritage: 'Pre-flight DXA scan; no densitometer flies', minutes: 0, plain: 'How dense your hip and spine bone is compared with before launch. It is estimated, because nothing on board can scan bone.' },
  fn: { heritage: 'Pre-flight DXA scan; no densitometer flies', minutes: 0, plain: 'Density at the neck of the thigh bone, where fractures matter most after landing. Estimated from the pre-flight scan.' },
  strength: { heritage: 'ARED resistive device on the ISS', minutes: 20, plain: 'How much force your muscles can still produce compared with before launch.' },
  exercise: { heritage: 'ARED, T2 and CEVIS on the ISS', minutes: 1, plain: 'The minutes you actually exercised per day, averaged over a week. It is the lever that protects bone and muscle.' },
  disc: { heritage: 'OCT and fundoscope used on the ISS', minutes: 10, plain: 'Swelling at the back of the eye where the optic nerve enters, graded 0 (none) to 5 (severe).' },
  acuity: { heritage: 'Vision checks performed on the ISS', minutes: 5, plain: 'How sharp your sight is. 1.0 is normal. A drop is the symptom that matters for mission work.' },
  wbc: { heritage: 'CSA Bio-Analyzer on the ISS', minutes: 15, plain: 'The total count of white blood cells, your defense against infection.' },
  lymph: { heritage: 'CSA Bio-Analyzer on the ISS', minutes: 0, plain: 'The white cells that coordinate the fight against viruses. Low counts are a flag to watch, not a diagnosis.' },
  energy: { heritage: 'Food logging on the ISS', minutes: 2, plain: 'How much of the energy you burn you actually ate. Below 100% the body breaks down its own tissue.' },
  mass: { heritage: 'SLAMMD on the ISS', minutes: 5, plain: 'Your body mass. Weight does not exist in orbit, so it is measured by how you move on a spring.' },
  glucose: { heritage: 'Point-of-care blood tests on the ISS', minutes: 5, plain: 'Blood sugar before the first meal. An early sign of how well the body handles energy while inactive.' },
  sleep: { heritage: 'Worn on the ISS (CSA Bio-Monitor)', minutes: 0, plain: 'How long you slept last night, from the wearable. Short sleep slows reaction and judgment.' },
  cognition: { heritage: 'Cognition battery used on the ISS', minutes: 10, plain: 'A short set of computer tasks that measure attention, memory and reaction speed against your own pre-flight scores.' },
  mood: { heritage: 'Daily check-in, logged by you', minutes: 1, plain: 'How you feel, rated 1 to 5. Only you can report it, and it is the earliest sign of isolation or overload.' },
  mission_dose: { heritage: 'Active personal dosimeter (ESA)', minutes: 0, plain: 'The radiation you have absorbed on this mission so far. It grows a little every day in deep space.' },
  career_dose: { heritage: 'Active personal dosimeter (ESA)', minutes: 0, plain: 'All the radiation you have absorbed across your career, against a lifetime limit that caps cancer risk.' },
  space_weather: { heritage: 'NASA DONKI public feed (CCMC)', minutes: 0, plain: 'How many fast protons from the Sun are passing the craft. A sharp rise means a solar storm, and a reason to shelter.' },
}

type SystemExtra = Pick<SystemDef, 'region' | 'evidence' | 'hotspotOffset'>

export const EXTRA_SYSTEM: Record<SystemId, SystemExtra> = {
  cardiovascular: { region: 'Heart and vessels', hotspotOffset: [0.05, 0, 0.1], evidence: 'Aerobic capacity has its own requirement, NASA-STD-3001 [V1 4003]. Aerobic sessions use T2 or CEVIS at 70–90% of maximum heart rate.' },
  skeletal: { region: 'Skeleton, hip focus', hotspotOffset: [-0.1, 0, 0.1], evidence: 'Lower-limb bone loss is about 0.8% per month in flight (Stavnichuk et al., 2020, npj Microgravity). Vitamin D at 800 IU/day has been the ISS standard since 2006.' },
  muscular: { region: 'Thighs, calves, arms', hotspotOffset: [0.04, 0, 0.1], evidence: 'On the ISS, T2 was used on 47% of days and CEVIS on 37% (NASA HRP evidence report). Strength has its own requirement, [V1 4024].' },
  neuro_ocular: { region: 'Eyes and optic nerve', hotspotOffset: [0.05, -0.02, 0.1], evidence: 'Spaceflight-associated neuro-ocular syndrome (SANS) is a red risk in the NASA Human Research Program, even though the challenge brief does not name it.' },
  immune: { region: 'Lymph nodes and spleen', hotspotOffset: [-0.04, 0, 0.1], evidence: 'Blood counts come from the Bio-Analyzer, which returns cell counts on board in 2–3 hours. Reference ranges are terrestrial, and labeled as such.' },
  nutrition: { region: 'Digestive tract', hotspotOffset: [0.05, 0, 0.1], evidence: 'Energy intake has its own requirement, NASA-STD-3001 [V1 4020]. Nutrition is a red risk in the Human Research Program.' },
  behavior: { region: 'Brain', hotspotOffset: [-0.07, 0.07, 0.04], evidence: 'Behavioral health and performance is a red risk in the Human Research Program. Cognition is tracked with the same test battery flown on the ISS.' },
  radiation: { region: 'Whole body', hotspotOffset: [0, 0, 0], evidence: 'The RAD instrument measured 1.8 mSv/day on the Mars Science Laboratory cruise (SwRI). Career dose is limited by NASA-STD-3001 [V1 4030].' },
}
