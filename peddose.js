/* PedDose: weight-based child dose helper for the Rx pad (dermatology drugs, Indian strengths).
   Hooks RxPad.onDraw. Shows when the patient is under 18 y (or weight < 40 kg):
   1) "Child dose helper" card: pick a drug → dose from weight/age → mL or tablets → ＋ Add to Rx.
   2) A dose line under every medicine row that matches the table, with age warnings (oral and topical).
   Doses: standard paediatric references (IAP Drug Formulary, BNF for Children, Nelson, product labels,
   ISPD/IJPD reviews). Strengths: common Indian products; the clinic medicine list (pharmacy) is used too.
   The doctor must check every dose. Nothing here is sent anywhere. Public: PedDose.DB, PedDose.calc(). */
(function(){
'use strict';
function up(s){return String(s==null?'':s).toUpperCase()}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

/* ---------- Drug table ----------
 type 'kg':   kg:[low, high, usual] mg/kg, per:'day' (split into n doses) | 'dose' | 'week'
 type 'band': bands:[[fromKg, toKg, mg per dose]]   type 'age': ages:[[fromMonths, toMonths, mg per dose]]
 forms: [FORM, strength label, mg per mL or per tab/cap, 'ML'|'TAB'|'CAP', pieces a tab may be split into]
 minM = minimum age (months), minKg = minimum weight, maxDose / maxDay in mg. */
var DB=[
// Antihistamines
{g:'LEVOCETIRIZINE',cat:'Antihistamine',use:'Urticaria, itch, eczema',type:'age',ages:[[6,72,1.25],[72,144,2.5],[144,999,5]],n:1,d:'0-0-1',t:'At bedtime',u:'2 weeks',minM:6,
 forms:[['SYP','2.5 MG/5 ML',0.5,'ML'],['TAB','5 MG',5,'TAB',2]],note:'6 m–5 y 1.25 mg OD; 6–11 y 2.5 mg OD; ≥12 y 5 mg OD. Do not exceed (children absorb about twice the adult level).'},
{g:'CETIRIZINE',cat:'Antihistamine',use:'Urticaria, itch',type:'age',ages:[[6,24,2.5],[24,72,2.5],[72,144,5],[144,999,10]],n:1,d:'0-0-1',t:'At bedtime',u:'2 weeks',minM:6,
 forms:[['SYP','5 MG/5 ML',1,'ML'],['TAB','10 MG',10,'TAB',2]],note:'6 m–5 y 2.5 mg OD (2–5 y may go to 2.5 mg BD); 6–11 y 5 mg OD–BD; ≥12 y 10 mg OD.'},
{g:'DESLORATADINE',cat:'Antihistamine',use:'Chronic urticaria',type:'age',ages:[[6,12,1],[12,72,1.25],[72,144,2.5],[144,999,5]],n:1,d:'0-0-1',t:'—',u:'2 weeks',minM:6,
 forms:[['SYP','2.5 MG/5 ML',0.5,'ML'],['TAB','5 MG',5,'TAB',2]],note:'6–11 m 1 mg; 1–5 y 1.25 mg; 6–11 y 2.5 mg; ≥12 y 5 mg, once daily.'},
{g:'FEXOFENADINE',cat:'Antihistamine',use:'Urticaria (non-sedating)',type:'age',ages:[[6,24,15],[24,144,30],[144,999,120]],n:2,d:'1-0-1',t:'—',u:'2 weeks',minM:6,
 forms:[['SUSP','30 MG/5 ML',6,'ML'],['TAB','30 MG',30,'TAB',1],['TAB','120 MG',120,'TAB',1]],note:'6 m–2 y 15 mg BD; 2–11 y 30 mg BD; ≥12 y 120–180 mg OD. Not with fruit juice.',
 adult:{n:1,d:'1-0-0'}},
{g:'HYDROXYZINE',cat:'Antihistamine',use:'Severe itch, sleep loss (sedating)',type:'kg',kg:[1,2,1.5],per:'day',n:3,d:'1-1-1',t:'After food',u:'1 week',minM:6,maxDayFn:function(m){return m<72?50:100},
 forms:[['SYP','10 MG/5 ML',2,'ML'],['TAB','10 MG',10,'TAB',2],['TAB','25 MG',25,'TAB',2]],note:'1–2 mg/kg/day in 3 doses (or the whole dose at night). Max 50 mg/day under 6 y, 100 mg/day 6 y+. Sedation; QT caution.'},
{g:'CHLORPHENIRAMINE',cat:'Antihistamine',use:'Itch (sedating)',type:'kg',kg:[0.35,0.35,0.35],per:'day',n:3,d:'1-1-1',t:'After food',u:'1 week',minM:24,maxDayFn:function(m){return m<72?6:12},
 forms:[['SYP','2 MG/5 ML',0.4,'ML'],['TAB','4 MG',4,'TAB',2]],note:'0.35 mg/kg/day in 3–4 doses. Not under 2 y. Max 6 mg/day (2–5 y), 12 mg/day (6–11 y).'},
{g:'CYPROHEPTADINE',cat:'Antihistamine',use:'Itch, cold urticaria',type:'kg',kg:[0.25,0.25,0.25],per:'day',n:3,d:'1-1-1',t:'After food',u:'1 week',minM:24,maxDayFn:function(m){return m<84?12:16},
 forms:[['SYP','2 MG/5 ML',0.4,'ML'],['TAB','4 MG',4,'TAB',2]],note:'0.25 mg/kg/day in 2–3 doses. Not under 2 y. Max 12 mg/day (2–6 y), 16 mg/day (7–14 y).'},
// Antibiotics
{g:'CEPHALEXIN',cat:'Antibiotic',use:'Impetigo, furunculosis, cellulitis, infected eczema',type:'kg',kg:[25,50,40],per:'day',n:3,d:'1-1-1',t:'After food',u:'7 days',maxDose:1000,maxDay:4000,
 forms:[['DROPS','100 MG/ML',100,'ML'],['SYP','125 MG/5 ML',25,'ML'],['SYP','250 MG/5 ML',50,'ML'],['CAP','250 MG',250,'CAP',1],['CAP','500 MG',500,'CAP',1]],note:'25–50 mg/kg/day in 3–4 doses (up to 100 for severe). Max 4 g/day.'},
{g:'CEFADROXIL',cat:'Antibiotic',use:'Impetigo, pyoderma',type:'kg',kg:[30,30,30],per:'day',n:2,d:'1-0-1',t:'After food',u:'7 days',maxDose:1000,maxDay:2000,
 forms:[['SYP','125 MG/5 ML',25,'ML'],['SYP','250 MG/5 ML',50,'ML'],['TAB','250 MG',250,'TAB',2],['TAB','500 MG',500,'TAB',1]],note:'30 mg/kg/day in 2 doses. Max 2 g/day.'},
{g:'AMOXICILLIN + CLAVULANIC ACID',cat:'Antibiotic',use:'Pyoderma, animal/human bites, cellulitis',type:'kg',kg:[25,45,40],per:'day',n:2,d:'1-0-1',t:'After food',u:'7 days',maxDose:875,minM:3,
 forms:[['SYP','228.5 MG/5 ML (200 MG AMOX)',40,'ML'],['SYP','457 MG/5 ML (400 MG AMOX)',80,'ML'],['TAB','375 MG (250 MG AMOX)',250,'TAB',1],['TAB','625 MG (500 MG AMOX)',500,'TAB',1]],note:'Dose by the AMOXICILLIN part: 25–45 mg/kg/day in 2 doses. Max 875 mg amoxicillin per dose.'},
{g:'CLOXACILLIN',cat:'Antibiotic',use:'Staph skin infection',type:'kg',kg:[50,100,50],per:'day',n:4,d:'1-1-1-1',t:'Empty stomach',u:'7 days',maxDose:1000,maxDay:4000,
 forms:[['SYP','125 MG/5 ML',25,'ML'],['CAP','250 MG',250,'CAP',1],['CAP','500 MG',500,'CAP',1]],note:'50–100 mg/kg/day in 4 doses, 1 h before food. Max 4 g/day.'},
{g:'AZITHROMYCIN',cat:'Antibiotic',use:'Pyoderma (penicillin allergy)',type:'kg',kg:[10,10,10],per:'dose',n:1,d:'1-0-0',t:'Empty stomach',u:'3 days',maxDose:500,
 forms:[['SUSP','100 MG/5 ML',20,'ML'],['SUSP','200 MG/5 ML',40,'ML'],['TAB','250 MG',250,'TAB',1],['TAB','500 MG',500,'TAB',1]],note:'10 mg/kg once daily × 3 days. Max 500 mg/day.'},
{g:'ERYTHROMYCIN',cat:'Antibiotic',use:'Pyoderma, acne (under 8 y), pityriasis rosea',type:'kg',kg:[30,50,40],per:'day',n:4,d:'1-1-1-1',t:'After food',u:'7 days',maxDose:500,maxDay:2000,
 forms:[['SYP','125 MG/5 ML',25,'ML'],['TAB','250 MG',250,'TAB',1],['TAB','500 MG',500,'TAB',1]],note:'30–50 mg/kg/day in 3–4 doses. Max 2 g/day. GI upset common.'},
{g:'CLARITHROMYCIN',cat:'Antibiotic',use:'Pyoderma (penicillin allergy)',type:'kg',kg:[15,15,15],per:'day',n:2,d:'1-0-1',t:'After food',u:'7 days',maxDose:500,minM:6,
 forms:[['SUSP','125 MG/5 ML',25,'ML'],['SUSP','250 MG/5 ML',50,'ML'],['TAB','250 MG',250,'TAB',1],['TAB','500 MG',500,'TAB',1]],note:'7.5 mg/kg twice daily. Max 500 mg/dose.'},
{g:'COTRIMOXAZOLE',cat:'Antibiotic',use:'MRSA skin infection',type:'kg',kg:[8,12,10],per:'day',n:2,d:'1-0-1',t:'After food',u:'7 days',maxDose:320,minM:2,
 forms:[['SUSP','TMP 40 MG + SMX 200 MG/5 ML',8,'ML'],['TAB','TMP 80 MG + SMX 400 MG',80,'TAB',2],['TAB','DS TMP 160 MG + SMX 800 MG',160,'TAB',2]],note:'Dose by TRIMETHOPRIM: 8–12 mg/kg/day in 2 doses. Not under 2 months. Check G6PD; stop if rash (SJS).'},
{g:'DOXYCYCLINE',cat:'Antibiotic',use:'Acne, MRSA (8 y and older)',type:'kg',kg:[2,4.4,4.4],per:'day',n:2,d:'1-0-1',t:'After food',u:'4 weeks',maxDose:100,minM:96,
 forms:[['TAB','100 MG',100,'TAB',2],['CAP','100 MG',100,'CAP',1]],note:'≥8 y: 2.2 mg/kg twice daily (acne: 2–4 mg/kg/day). Max 100 mg/dose. Under 8 y only short courses (≤21 days). Take with water, stay upright 30 min; photosensitivity.'},
// Antifungals
{g:'TERBINAFINE',cat:'Antifungal',use:'Tinea capitis / corporis',type:'band',bands:[[0,20,62.5],[20,40,125],[40,999,250]],n:1,d:'1-0-0',t:'After food',u:'4 weeks',minM:24,
 forms:[['TAB','250 MG',250,'TAB',4],['TAB','125 MG',125,'TAB',2]],note:'<20 kg 62.5 mg; 20–40 kg 125 mg; >40 kg 250 mg once daily. Tinea capitis 2–4 wk (T. tonsurans); less good for Microsporum. LFT if long course.'},
{g:'GRISEOFULVIN',cat:'Antifungal',use:'Tinea capitis (Microsporum, Trichophyton)',type:'kg',kg:[20,25,20],per:'day',n:1,d:'1-0-0',t:'With food',u:'8 weeks',maxDose:1000,minM:1,
 forms:[['TAB','125 MG',125,'TAB',2],['TAB','250 MG',250,'TAB',2],['TAB','500 MG',500,'TAB',2]],note:'Microsize 20–25 mg/kg/day with fatty food (milk, ghee), 6–8 weeks. Max 1 g/day. Photosensitivity.'},
{g:'FLUCONAZOLE',cat:'Antifungal',use:'Tinea capitis (daily) / candidiasis',type:'kg',kg:[3,6,6],per:'day',n:1,d:'1-0-0',t:'After food',u:'3 weeks',maxDose:400,
 forms:[['SUSP','50 MG/5 ML',10,'ML'],['TAB','50 MG',50,'TAB',1],['TAB','100 MG',100,'TAB',2],['TAB','150 MG',150,'TAB',1]],note:'Tinea capitis 6 mg/kg/day × 3–6 wk. Candidiasis 3–6 mg/kg/day. Neonates: longer dose interval.'},
{g:'FLUCONAZOLE',name:'FLUCONAZOLE (WEEKLY)',alt:1,cat:'Antifungal',use:'Tinea capitis / versicolor, weekly',type:'kg',kg:[6,8,6],per:'week',n:1,d:'Once weekly',t:'After food',u:'8 weeks',maxDose:400,
 forms:[['SUSP','50 MG/5 ML',10,'ML'],['TAB','50 MG',50,'TAB',1],['TAB','150 MG',150,'TAB',1]],note:'6–8 mg/kg once a WEEK × 8–12 weeks.'},
{g:'ITRACONAZOLE',cat:'Antifungal',use:'Tinea capitis, extensive tinea, candidiasis',type:'kg',kg:[3,5,5],per:'day',n:1,d:'1-0-0',t:'With food',u:'4 weeks',maxDose:200,
 forms:[['CAP','100 MG',100,'CAP',1],['CAP','200 MG',200,'CAP',1]],note:'Capsules 5 mg/kg/day with a full meal (pulse: 1 wk on, 3 wk off). Capsules cannot be split: round, or open and mix pellets in food. LFT if long course.'},
{g:'NYSTATIN',cat:'Antifungal',use:'Oral thrush, napkin candidiasis (with gut source)',type:'age',ages:[[0,12,100000],[12,999,400000]],n:4,d:'1-1-1-1',t:'After food',u:'7 days',unitTxt:'UNITS',
 forms:[['SUSP','100,000 UNITS/ML',100000,'ML']],note:'Infants 1 mL (100,000 U) 4 times a day; children 4–6 mL 4 times a day. Continue 48 h after cure.'},
// Antivirals
{g:'ACYCLOVIR',name:'ACYCLOVIR (CHICKENPOX / ZOSTER)',cat:'Antiviral',use:'Varicella, herpes zoster',type:'kg',kg:[20,20,20],per:'dose',n:4,d:'1-1-1-1',t:'—',u:'5 days',maxDose:800,minM:24,
 forms:[['SUSP','400 MG/5 ML',80,'ML'],['TAB','200 MG',200,'TAB',1],['TAB','400 MG',400,'TAB',2],['TAB','800 MG',800,'TAB',2]],note:'20 mg/kg 4 times a day × 5 days (max 800 mg/dose); start within 24 h of rash. Zoster in children: 5 times a day. Keep well hydrated.'},
{g:'ACYCLOVIR',name:'ACYCLOVIR (HERPES SIMPLEX)',alt:1,cat:'Antiviral',use:'Herpetic gingivostomatitis, eczema herpeticum (oral)',type:'kg',kg:[15,15,15],per:'dose',n:5,d:'As directed',t:'—',u:'7 days',maxDose:200,
 forms:[['SUSP','400 MG/5 ML',80,'ML'],['TAB','200 MG',200,'TAB',1]],note:'15 mg/kg 5 times a day × 7 days (max 200 mg/dose). Eczema herpeticum that is widespread or in an unwell child: admit for IV.'},
{g:'VALACYCLOVIR',cat:'Antiviral',use:'Varicella, zoster (2 y and older)',type:'kg',kg:[20,20,20],per:'dose',n:3,d:'1-1-1',t:'—',u:'5 days',maxDose:1000,minM:24,
 forms:[['TAB','500 MG',500,'TAB',2],['TAB','1000 MG',1000,'TAB',2]],note:'20 mg/kg 3 times a day × 5 days (max 1 g/dose). Tablets only in India.'},
// Scabies, worms
{g:'IVERMECTIN',cat:'Scabies / worms',use:'Scabies (crusted, institutional, or permethrin failure)',type:'band',bands:[[15,25,3],[25,36,6],[36,51,9],[51,66,12],[66,80,15],[80,999,18]],n:1,d:'As directed',t:'Empty stomach',u:'2 doses, 1 week apart',minKg:15,
 forms:[['TAB','3 MG',3,'TAB',1],['TAB','6 MG',6,'TAB',2],['TAB','12 MG',12,'TAB',2]],note:'200 mcg/kg single dose, repeat after 7–14 days. Not under 15 kg. Treat all family members together.'},
{g:'ALBENDAZOLE',cat:'Scabies / worms',use:'Cutaneous larva migrans',type:'age',ages:[[12,24,200],[24,999,400]],n:1,d:'1-0-0',t:'After food',u:'3 days',minM:12,
 forms:[['SUSP','200 MG/5 ML',40,'ML'],['TAB','400 MG',400,'TAB',2]],note:'1–2 y 200 mg; ≥2 y 400 mg once daily × 3 days for larva migrans (fatty food helps).'},
// Steroids and immune drugs
{g:'PREDNISOLONE',cat:'Steroid / immune',use:'Severe acute urticaria, contact dermatitis, short courses',type:'kg',kg:[0.5,2,1],per:'day',n:1,d:'1-0-0',t:'After food',u:'5 days',maxDose:60,
 forms:[['SYP','5 MG/5 ML',1,'ML'],['SYP','15 MG/5 ML',3,'ML'],['TAB','5 MG',5,'TAB',2],['TAB','10 MG',10,'TAB',2],['TAB','20 MG',20,'TAB',2]],note:'0.5–2 mg/kg/day once in the morning (max 60 mg). Taper if more than 2 weeks. Check for varicella contact.'},
{g:'METHOTREXATE',cat:'Steroid / immune',use:'Psoriasis, severe eczema, morphea (specialist)',type:'kg',kg:[0.2,0.4,0.3],per:'week',n:1,d:'Once weekly',t:'After food',u:'12 weeks',maxDose:25,
 forms:[['TAB','2.5 MG',2.5,'TAB',1],['TAB','5 MG',5,'TAB',1],['TAB','7.5 MG',7.5,'TAB',1],['TAB','10 MG',10,'TAB',1]],note:'0.2–0.4 mg/kg ONCE A WEEK (max 25 mg/week). Write the weekday. Folic acid on the other days. CBC + LFT + creatinine at start and every 1–3 months. No live vaccines.'},
{g:'CYCLOSPORINE',cat:'Steroid / immune',use:'Severe atopic dermatitis, psoriasis (specialist)',type:'kg',kg:[3,5,4],per:'day',n:2,d:'1-0-1',t:'After food',u:'12 weeks',
 forms:[['SOLN','100 MG/ML',100,'ML'],['CAP','25 MG',25,'CAP',1],['CAP','50 MG',50,'CAP',1],['CAP','100 MG',100,'CAP',1]],note:'3–5 mg/kg/day in 2 doses. BP and creatinine every 2 weeks at first, then monthly. Short courses. No grapefruit.'},
{g:'AZATHIOPRINE',cat:'Steroid / immune',use:'Severe eczema, bullous disease (specialist)',type:'kg',kg:[1,3,2],per:'day',n:1,d:'1-0-0',t:'After food',u:'12 weeks',
 forms:[['TAB','25 MG',25,'TAB',2],['TAB','50 MG',50,'TAB',2]],note:'1–3 mg/kg/day. Check TPMT if possible; CBC weekly × 4 then monthly; LFT.'},
{g:'DAPSONE',cat:'Steroid / immune',use:'Linear IgA, DH, vasculitis, leprosy (specialist)',type:'kg',kg:[1,2,1],per:'day',n:1,d:'1-0-0',t:'After food',u:'4 weeks',maxDose:100,
 forms:[['TAB','25 MG',25,'TAB',2],['TAB','50 MG',50,'TAB',2],['TAB','100 MG',100,'TAB',2]],note:'1–2 mg/kg/day (max 100 mg). G6PD test BEFORE starting. Watch for haemolysis, methaemoglobinaemia, dapsone syndrome.'},
{g:'HYDROXYCHLOROQUINE',cat:'Steroid / immune',use:'Lupus (skin), morphea, PMLE (specialist)',type:'kg',kg:[3,5,5],per:'day',n:1,d:'1-0-0',t:'After food',u:'12 weeks',maxDose:400,
 forms:[['TAB','200 MG',200,'TAB',2],['TAB','300 MG',300,'TAB',1]],note:'Up to 5 mg/kg/day of actual weight (max 400 mg). Eye check at baseline and yearly after 5 years. Can give weekly total split by days.'},
{g:'ISOTRETINOIN',cat:'Steroid / immune',use:'Severe / nodular acne (12 y and older)',type:'kg',kg:[0.25,1,0.5],per:'day',n:1,d:'0-1-0',t:'With food',u:'4 weeks',minM:144,
 forms:[['CAP','5 MG',5,'CAP',1],['CAP','10 MG',10,'CAP',1],['CAP','20 MG',20,'CAP',1]],note:'≥12 y: 0.5–1 mg/kg/day with fatty food (low dose 0.25–0.5 often used). Girls: pregnancy test, contraception. Lipids + LFT at start and 1 month. Watch mood. No tetracyclines together.'},
// Other
{g:'PROPRANOLOL',cat:'Other',use:'Infantile haemangioma (specialist)',type:'kg',kg:[1,3,2],per:'day',n:2,d:'1-0-1',t:'With food',u:'4 weeks',minM:1,maxDose:40,
 forms:[['TAB','10 MG',10,'TAB',4],['TAB','40 MG',40,'TAB',4]],note:'Start 1 mg/kg/day in 2 doses, raise weekly to 2–3 mg/kg/day; usually 6–12 months. Give with/after feeds (hypoglycaemia); stop during vomiting or poor feeding. HR/BP check 1–2 h after first dose and each increase. Tablet dissolved in a measured amount of water for small doses.'},
{g:'ZINC',name:'ZINC (ELEMENTAL)',cat:'Other',use:'Acrodermatitis enteropathica, zinc deficiency',type:'kg',kg:[1,3,2],per:'day',n:1,d:'1-0-0',t:'After food',u:'4 weeks',
 forms:[['SYP','20 MG/5 ML (ELEMENTAL)',4,'ML'],['TAB','20 MG (DISPERSIBLE)',20,'TAB',2]],note:'1–3 mg/kg/day of elemental zinc. Lifelong in acrodermatitis enteropathica; check zinc level.'},
{g:'PARACETAMOL',cat:'Other',use:'Pain, fever (zoster, after procedures)',type:'kg',kg:[10,15,15],per:'dose',n:4,d:'SOS (if needed)',t:'After food',u:'3 days',maxDose:1000,sos:1,maxDayKg:60,
 forms:[['DROPS','100 MG/ML',100,'ML'],['SYP','120 MG/5 ML',24,'ML'],['SYP','250 MG/5 ML',50,'ML'],['TAB','500 MG',500,'TAB',2]],note:'15 mg/kg every 6 h if needed. Max 60 mg/kg/day and 4 doses/day.'},
{g:'IBUPROFEN',cat:'Other',use:'Pain, fever',type:'kg',kg:[5,10,10],per:'dose',n:3,d:'SOS (if needed)',t:'After food',u:'3 days',maxDose:400,minM:3,sos:1,maxDayKg:30,
 forms:[['SUSP','100 MG/5 ML',20,'ML'],['TAB','200 MG',200,'TAB',2],['TAB','400 MG',400,'TAB',2]],note:'5–10 mg/kg every 6–8 h if needed, after food. Max 30–40 mg/kg/day. Avoid in varicella, dehydration, asthma flare.'}
];
/* Topicals: age limits shown under matching medicine rows. [pattern, min age months, message] */
var TOP=[
[/PERMETHRIN/,2,'Permethrin 5%: from 2 months. Under 2 y include scalp, face (avoid eyes, mouth) and between fingers/toes; wash off after 8–12 h; repeat in 1 week.'],
[/TACROLIMUS.*0?\.1/,192,'Tacrolimus 0.1%: 16 y and older. Use 0.03% for 2–15 y.'],
[/TACROLIMUS/,24,'Tacrolimus 0.03%: from 2 y. Burning in first week is common.'],
[/PIMECROLIMUS/,24,'Pimecrolimus 1%: from 2 y (label).'],
[/CLOBETASOL|HALOBETASOL/,144,'Super-potent steroid: avoid under 12 y except short specialist use; never on face, folds or napkin area.'],
[/BETAMETHASONE|FLUOCINOLONE|MOMETASONE|HALCINONIDE/,24,'Potent steroid: short courses; avoid face, folds, napkin area; mometasone from 2 y.'],
[/ADAPALENE|TRETINOIN|TAZAROTENE/,108,'Topical retinoid: labelled 12 y+; used from about 9 y for acne.'],
[/BENZOYL/,108,'Benzoyl peroxide: labelled 12 y+; used from about 9 y for acne.'],
[/HYDROQUINONE|KOJIC|TRIPLE/,144,'Depigmenting creams: avoid under 12 y.'],
[/LINDANE|GAMMA BENZENE/,999,'Lindane: avoid in children (neurotoxic). Prefer permethrin.'],
[/BENZYL BENZOATE/,24,'Benzyl benzoate 25%: dilute 1:1 with water for children; avoid under 2 y (use permethrin).'],
[/SALICYLIC/,24,'Salicylic acid: avoid large areas under 2 y (salicylism).'],
[/SILVER SULF/,2,'Silver sulfadiazine: not under 2 months.'],
[/MUPIROCIN/,2,'Mupirocin: from 2 months; max 10 days.'],
[/IVERMECTIN.*(LOTION|CREAM)/,6,'Ivermectin lotion: from 6 months.'],
[/LULICONAZOLE|EBERCONAZOLE|SERTACONAZOLE/,216,'Children: safety not fully established on the label; clotrimazole/miconazole are well studied in children.'],
[/PODOPHYLL/,999,'Podophyllin: avoid in children.'],
[/MINOXIDIL/,216,'Minoxidil: under 18 y only on specialist advice.']
];
/* Fingertip units by age (Long & Finlay): face&neck, one arm&hand, one leg&foot, trunk front, trunk back+buttocks. 1 FTU ≈ 0.5 g */
var FTU=[['3–6 m',[1,1,1.5,1,1.5]],['1–2 y',[1.5,1.5,2,2,3]],['3–5 y',[1.5,2,3,3,3.5]],['6–10 y',[2,2.5,4.5,3.5,5]]];

/* ---------- helpers ---------- */
function ageMonths(a){a=String(a||'').toLowerCase().trim();if(!a)return NaN;var y=a.match(/(\d+(?:\.\d+)?)\s*(y|yr|yrs|year|years)\b/),m=a.match(/(\d+(?:\.\d+)?)\s*(m|mo|mon|mons|month|months)\b/),w=a.match(/(\d+(?:\.\d+)?)\s*(w|wk|wks|week|weeks)\b/),d=a.match(/(\d+(?:\.\d+)?)\s*(d|day|days)\b/);
  if(y||m||w||d)return(y?+y[1]*12:0)+(m?+m[1]:0)+(w?+w[1]/4.35:0)+(d?+d[1]/30.4:0);var n=parseFloat(a);return isNaN(n)?NaN:n*12}
function ageTxt(m){return m<1?Math.round(m*30)+' d':m<24?Math.round(m)+' m':(Math.round(m/12*10)/10)+' y'}
function num(x){return Math.round(x*100)/100}
function frac(q){var w=Math.floor(q+1e-9),f=Math.round((q-w)*4)/4,s={0:'',0.25:'¼',0.5:'½',0.75:'¾'}[f];if(f===1){w++;s=''}return(w?String(w):'')+(s||'')||'0'}
function key(d){return d.name||d.g}
function find(g){g=up(g).trim();if(!g)return null;return DB.find(function(d){return !d.alt&&(g===d.g||g.indexOf(d.g)===0||(d.g.indexOf('+')>0&&g.replace(/\s+/g,'').indexOf(d.g.replace(/\s+/g,''))===0))})||(g.indexOf('AMOXY')===0&&g.indexOf('CLAV')>0?DB.find(function(d){return /CLAVUL/.test(d.g)}):null)||(g.indexOf('CO-TRIMOX')===0||g.indexOf('TRIMETHOPRIM')===0?DB.find(function(d){return d.g==='COTRIMOXAZOLE'}):null)||(g.indexOf('CICLOSPORIN')===0?DB.find(function(d){return d.g==='CYCLOSPORINE'}):null)||(g.indexOf('ACICLOVIR')===0?DB.find(function(d){return d.g==='ACYCLOVIR'}):null)}
function parseStr(s){s=up(s);var m=s.match(/([\d.]+)\s*MG\s*\/\s*([\d.]+)\s*ML/);if(m)return{per:+m[1]/+m[2],unit:'ML'};m=s.match(/([\d.]+)\s*MG\s*\/\s*ML/);if(m)return{per:+m[1],unit:'ML'};m=s.match(/^([\d.]+)\s*MG$/);if(m)return{per:+m[1]};return null}
/* forms from the table + matching items on the clinic medicine list (pharmacy) */
function formsFor(d){var out=d.forms.map(function(f){return{f:f[0],s:f[1],per:f[2],unit:f[3],split:f[4]||1}}),fml=[];
  try{fml=(window.A&&A.fml&&A.fml())||[]}catch(e){}
  fml.forEach(function(x){if(up(x.g).indexOf(d.g)!==0)return;var p=parseStr(x.s);if(!p)return;var liq=/SYP|SUSP|DROPS|SOLN/.test(x.f||'')||p.unit==='ML';
    var have=out.find(function(o){return o.f===x.f&&Math.abs(o.per-p.per)<1e-6});if(have){have.stock=x.brand||1;return}
    out.push({f:x.f||(liq?'SYP':'TAB'),s:up(x.s),per:p.per,unit:liq?'ML':(x.f==='CAP'?'CAP':'TAB'),split:x.f==='CAP'?1:2,stock:x.brand||1})});
  return out}

/* core calculation: target mg per dose (range), then rounded to the chosen form */
function calc(d,wt,am,mgkg,form){var r={warn:[],n:d.n,d:d.d},adultAge=am>=144;
  if(d.minM&&!(am>=d.minM))r.warn.push('Not usually for age under '+ageTxt(d.minM)+(isNaN(am)?' (age not entered)':''));
  if(d.minKg&&!(wt>=d.minKg))r.warn.push('Not for weight under '+d.minKg+' kg');
  if(d.type==='kg'){if(!(wt>0)){r.need='weight';return r}
    var k=mgkg||d.kg[2],per=d.per==='dose'?k*wt:k*wt/(d.per==='week'?1:d.n);
    r.lo=d.per==='dose'?d.kg[0]*wt:d.kg[0]*wt/(d.per==='week'?1:d.n);r.hi=d.per==='dose'?d.kg[1]*wt:d.kg[1]*wt/(d.per==='week'?1:d.n);
    var cap=d.maxDose||Infinity;if(d.maxDay)cap=Math.min(cap,d.maxDay/d.n);if(d.maxDayFn)cap=Math.min(cap,d.maxDayFn(isNaN(am)?0:am)/d.n);if(d.maxDayKg)cap=Math.min(cap,d.maxDayKg*wt/d.n);
    if(per>cap){per=cap;r.capped=1}r.mg=per;r.k=k;
    if(mgkg&&(mgkg<d.kg[0]-1e-9||mgkg>d.kg[1]+1e-9))r.warn.push('Outside the usual range '+d.kg[0]+'–'+d.kg[1]+' mg/kg/'+d.per)}
  else if(d.type==='band'){if(!(wt>0)){r.need='weight';return r}var b=d.bands.find(function(x){return wt>=x[0]&&wt<x[1]});if(!b){r.warn.push('No dose for this weight');return r}r.mg=b[2];r.band=b}
  else{if(isNaN(am)){r.need='age';return r}var a=d.ages.find(function(x){return am>=x[0]&&am<x[1]});if(!a){r.warn.push('No dose for this age');return r}r.mg=a[2];r.band=a;
    if(adultAge&&d.adult){r.n=d.adult.n;r.d=d.adult.d}}
  if(form&&r.mg){var q;if(form.unit==='ML'){var v=r.mg/form.per,st=form.f==='DROPS'||form.per>=50||v<1?0.1:0.5;q=Math.max(st,Math.round(v/st)*st);r.qty=num(q);r.qtyTxt=num(q)+' ML'}
    else{var sp=form.split||1;q=Math.round(r.mg/form.per*sp)/sp;if(q<=0){q=1/sp;r.warn.push('Smallest piece is more than the dose; use the liquid')}r.qty=q;r.qtyTxt=frac(q)+' '+(form.unit==='CAP'?'CAP':'TAB')}
    r.given=q*form.per;if(r.mg&&Math.abs(r.given-r.mg)/r.mg>0.2)r.warn.push('This strength gives '+fmtMg(r.given,d)+' but '+fmtMg(r.mg,d)+' is needed: use '+(form.unit==='ML'?'another strength':'the syrup or a smaller tablet'));
    if(form.unit==='ML'&&r.qty>20)r.warn.push('Large volume: consider tablets');}
  return r}
function pickForm(d,wt,am,forms){var best=null,be=1e9;forms.forEach(function(f,i){var c=calc(d,wt,am,null,f);if(!c.mg)return;var e=Math.abs(c.given-c.mg)/c.mg;
  var liq=f.unit==='ML',small=(wt>0&&wt<25)||(!isNaN(am)&&am<84);if(small&&!liq)e+=0.25;if(!small&&liq)e+=0.15;if(liq&&c.qty>15)e+=0.5;if(f.stock)e-=0.05;if(e<be){be=e;best=i}});return best==null?0:best}
function unitLbl(d){return d.unitTxt||'MG'}
function fmtMg(x,d){return d&&d.unitTxt?Math.round(x).toLocaleString('en-IN')+' '+d.unitTxt:((x>=10?Math.round(x):num(x))+' MG')}
function freqTxt(d,r){var n=r.n;return d.per==='week'?'ONCE A WEEK':d.sos?'IF NEEDED, UP TO '+n+' TIMES A DAY':n===1?'ONCE A DAY':n===2?'TWICE A DAY':n===3?'3 TIMES A DAY':n===4?'4 TIMES A DAY':n+' TIMES A DAY'}
function teQty(f,r){return f.unit==='ML'?'ప్రతిసారి '+r.qty+' ml':'ప్రతిసారి '+r.qtyTxt.replace(' TAB',' మాత్ర').replace(' CAP',' క్యాప్సూల్')}

/* ---------- UI ---------- */
var css=0,state={};
function addCss(){if(css)return;css=1;var s=document.createElement('style');s.textContent=
'.pdc{border-color:#fcd34d!important;background:#fffbeb!important}.pdc h3{margin:0;font-size:16px}.pdc .hd{display:flex;justify-content:space-between;align-items:center;gap:8px;cursor:pointer}'+
'.pdc .pw{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.pdc .cats{margin:8px 0 4px}.pdc .cats .chip{background:#fef3c7;color:#92400e}.pdc .cats .chip.on{background:#b45309;color:#fff}'+
'.pdc .dl{display:flex;flex-wrap:wrap;gap:4px}.pdc .dl .chip{background:#fff;border:1px solid #fcd34d;color:#78350f}.pdc .dl .chip.on{background:#0369a1;border-color:#0369a1;color:#fff}'+
'.pdc .res{background:#fff;border:1px solid #fde68a;border-radius:12px;padding:10px;margin-top:8px}.pdc .big{font-size:22px;font-weight:900;color:#0c4a6e}.pdc .wr{color:#b91c1c;font-weight:700;font-size:13px;margin-top:4px}'+
'.pdc table{border-collapse:collapse;font-size:12px;width:100%;margin-top:6px}.pdc td,.pdc th{border:1px solid #fde68a;padding:3px 5px;text-align:center}.pdc .src{font-size:11px;color:#78350f;margin-top:6px}'+
'.rxp .pdl{grid-column:1/-1;font-size:12px;border-radius:8px;padding:5px 8px;margin-top:4px;background:#fffbeb;color:#78350f}.rxp .pdl.bad{background:#fee2e2;color:#991b1b;font-weight:700}'+
'@media(max-width:600px){.pdc .pw{grid-template-columns:1fr 1fr}}';document.head.appendChild(s)}
function ld(){try{return JSON.parse(localStorage.getItem('scc_peddose')||'{}')}catch(e){return{}}}
function sv(o){try{localStorage.setItem('scc_peddose',JSON.stringify(o))}catch(e){}}

function onDraw(root,rx,api){addCss();var A_=root.querySelector('#rxA'),W_=root.querySelector('#rxW');if(!A_)return;
  var st=state[rx.id]||(state[rx.id]={cat:'',q:'',sel:null,fi:null,mgkg:null,dur:null});
  var first=root.querySelector('.w > .cd:not(.warn)')||root.querySelector('.cd');var all=root.querySelectorAll('.w > .cd');first=all[0];
  var card=document.createElement('div');card.className='cd pdc';card.id='pdCard';if(first&&first.nextSibling)first.parentNode.insertBefore(card,first.nextSibling);else if(first)first.parentNode.appendChild(card);
  function wt(){return parseFloat((W_&&W_.value)||st.w||'')}
  function am(){return ageMonths(A_.value)}
  function show(){var a=am(),w=wt();return(a<216)||(w>0&&w<40)}
  function render(){if(!show()){card.style.display='none';rows();return}card.style.display='';var a=am(),w=wt(),P=ld(),open=P.open!==false;
    var cats=[];DB.forEach(function(d){if(cats.indexOf(d.cat)<0)cats.push(d.cat)});
    var list=DB.filter(function(d){return(!st.cat||d.cat===st.cat)&&(!st.q||key(d).indexOf(up(st.q))>=0||up(d.use).indexOf(up(st.q))>=0)});
    var h='<div class="hd" id="pdHd"><h3>👶 Child dose helper'+(w>0?' · '+w+' kg':'')+(!isNaN(a)?' · '+ageTxt(a):'')+'</h3><span class="muted">'+(open?'▲ hide':'▼ open')+'</span></div>';
    if(open){h+='<div class="pw"><div><label>Weight (kg) *</label><input id="pdW" inputmode="decimal" value="'+esc(W_&&W_.value||st.w||'')+'" placeholder="e.g. 14"></div><div><label>Find drug</label><input id="pdQ" value="'+esc(st.q)+'" placeholder="e.g. cephalexin, itch"></div></div>'+
      (!(w>0)?'<div class="wr">Enter the child\'s weight for mg/kg doses.</div>':'')+
      '<div class="cats">'+['All'].concat(cats).map(function(c){var on=(c==='All'&&!st.cat)||c===st.cat;return'<button class="chip'+(on?' on':'')+'" data-pc="'+esc(c)+'">'+esc(c)+'</button>'}).join('')+'</div>'+
      '<div class="dl">'+list.map(function(d){var i=DB.indexOf(d);return'<button class="chip'+(st.sel===i?' on':'')+'" data-pd="'+i+'">'+esc(key(d))+'</button>'}).join('')+(list.length?'':'<span class="muted">No match</span>')+'</div>';
      if(st.sel!=null&&DB[st.sel])h+=result(DB[st.sel],w,a);
      h+='<details style="margin-top:8px"><summary class="muted" style="cursor:pointer"><b>Creams: how much to apply (fingertip units)</b></summary><table><tr><th>Age</th><th>Face+neck</th><th>1 arm+hand</th><th>1 leg+foot</th><th>Chest+tummy</th><th>Back+buttocks</th></tr>'+
       FTU.map(function(r){return'<tr><td>'+r[0]+'</td>'+r[1].map(function(x){return'<td>'+x+'</td>'}).join('')+'</tr>'}).join('')+'</table><div class="src">1 fingertip unit ≈ 0.5 g (adult fingertip). Topical age limits show under each cream you add.</div></details>'+
      '<div class="src">Doses from standard paediatric references (IAP Drug Formulary, BNF for Children, Nelson, product labels). Strengths are common Indian products; your pharmacy list is added when it matches. <b>Check every dose before printing.</b></div>'}
    card.innerHTML=h;bindCard();rows()}
  function result(d,w,a){var F=formsFor(d);if(st.fi==null||!F[st.fi])st.fi=pickForm(d,w,a,F);var f=F[st.fi],r=calc(d,w,a,st.mgkg,f);
    var h='<div class="res"><div><b>'+esc(key(d))+'</b> <span class="muted">· '+esc(d.use)+'</span></div>'+
     '<div class="pw"><div><label>Strength</label><select id="pdF">'+F.map(function(x,i){return'<option value="'+i+'"'+(i===st.fi?' selected':'')+'>'+esc(x.f+' '+x.s)+(x.stock?' · in pharmacy':'')+'</option>'}).join('')+'</select></div>'+
     (d.type==='kg'?'<div><label>mg/kg/'+d.per+' (usual '+d.kg[0]+(d.kg[1]!==d.kg[0]?'–'+d.kg[1]:'')+')</label><input id="pdK" inputmode="decimal" value="'+(st.mgkg||d.kg[2])+'"></div>':'<div><label>Dose rule</label><input disabled value="'+(d.type==='band'?'By weight band':'By age')+'"></div>')+
     '<div><label>Duration</label><input id="pdU" value="'+esc(st.dur||d.u)+'"></div></div>';
    if(r.need)h+='<div class="wr">Enter the child\'s '+r.need+' to calculate.</div>';
    else if(r.mg){h+='<div style="margin-top:8px"><span class="big">'+esc(r.qtyTxt)+'</span> <b>'+freqTxt(d,r)+'</b></div>'+
      '<div class="muted">= '+fmtMg(r.given,d)+' per dose'+(d.type==='kg'&&w>0?' ('+num(r.given*(d.per==='dose'?1:d.per==='week'?1:r.n)/w)+' mg/kg/'+(d.per==='dose'?'dose':d.per)+')':'')+
      (d.type==='kg'&&r.lo!=null?' · range '+fmtMg(r.lo,d)+'–'+fmtMg(r.hi,d)+' per dose':'')+(r.capped?' · <b>capped at max</b>':'')+'</div>'}
    r.warn.forEach(function(x){h+='<div class="wr">⚠ '+esc(x)+'</div>'});
    h+='<div class="src" style="font-size:12px">'+esc(d.note)+'</div>'+(r.mg&&!r.need?'<button class="p" id="pdAdd" style="margin-top:8px;width:100%">＋ Add to Rx</button>':'')+'</div>';
    st._r=r;st._f=f;return h}
  function bindCard(){var hd=card.querySelector('#pdHd');hd.onclick=function(){var P=ld();P.open=P.open===false;sv(P);render()};
    var w=card.querySelector('#pdW');if(w)w.oninput=function(){st.w=w.value;if(W_){W_.value=w.value;W_.style.borderColor=''}var p=w.selectionStart;render();var n=card.querySelector('#pdW');if(n){n.focus();try{n.setSelectionRange(p,p)}catch(e){}}};
    var q=card.querySelector('#pdQ');if(q)q.oninput=function(){st.q=q.value;var p=q.selectionStart;render();var n=card.querySelector('#pdQ');if(n){n.focus();try{n.setSelectionRange(p,p)}catch(e){}}};
    card.querySelectorAll('[data-pc]').forEach(function(b){b.onclick=function(){st.cat=b.dataset.pc==='All'?'':b.dataset.pc;render()}});
    card.querySelectorAll('[data-pd]').forEach(function(b){b.onclick=function(){var i=+b.dataset.pd;if(st.sel!==i){st.sel=i;st.fi=null;st.mgkg=null;st.dur=null}else st.sel=null;render()}});
    var f=card.querySelector('#pdF');if(f)f.onchange=function(){st.fi=+f.value;render()};
    var k=card.querySelector('#pdK');if(k)k.onchange=function(){var v=parseFloat(k.value);st.mgkg=v>0?v:null;render()};
    var u=card.querySelector('#pdU');if(u)u.onchange=function(){st.dur=u.value};
    var ad=card.querySelector('#pdAdd');if(ad)ad.onclick=function(){var d=DB[st.sel],r=st._r,fm=st._f;if(!r||!r.mg)return;api.read();if(W_&&!rx.p.wt)rx.p.wt=W_.value;
      var te=api.cfg&&api.cfg.telugu?' / '+teQty(fm,r)+(d.per==='week'?' (వారానికి ఒకసారి)':''):'';
      var note=r.qtyTxt+' '+(d.per==='week'?'ONCE A WEEK':d.sos?'IF NEEDED (MAX '+r.n+'/DAY)':'EACH TIME')+(fm.unit==='ML'||d.unitTxt?' (= '+fmtMg(r.given,d)+')':'')+(r.n===5&&d.d==='As directed'?' · 5 TIMES A DAY':'')+(d.g==='IVERMECTIN'?' · SINGLE DOSE, REPEAT AFTER 1 WEEK':'')+(d.g==='METHOTREXATE'?' · DAY: ________':'')+te;
      rx.m.push({f:fm.f,g:d.g,s:fm.s,d:r.d,t:d.t,u:(card.querySelector('#pdU')||{}).value||d.u,n:note,_t:'Child dose'});
      st.sel=null;api.draw();var rs=document.querySelectorAll('#rxM .m');var last=rs[rs.length-1];if(last)last.scrollIntoView({block:'center'})}}
  /* a dose line under each medicine row */
  function rows(){var a=am(),w=wt();root.querySelectorAll('#rxM .m').forEach(function(row){var old=row.querySelector('.pdl');if(old)old.remove();
      if(!(a<216)&&!(w>0&&w<40))return;var m=rx.m[+row.dataset.i];if(!m)return;var g=up((row.querySelector('[data-k="g"]')||{}).value||m.g),txt='',bad=0;
      var d=find(g);if(d){var F=formsFor(d),fs=up((row.querySelector('[data-k="s"]')||{}).value||m.s),ff=(row.querySelector('[data-k="f"]')||{}).value||m.f,fi=F.findIndex(function(x){return x.f===ff&&up(x.s)===fs});
        if(fi<0){var p=parseStr(fs);if(p)F.push({f:ff,s:fs,per:p.per,unit:p.unit==='ML'||/SYP|SUSP|DROPS|SOLN/.test(ff)?'ML':(ff==='CAP'?'CAP':'TAB'),split:ff==='CAP'?1:2}),fi=F.length-1}
        var r=calc(d,w,a,null,fi>=0?F[fi]:null);bad=r.warn.length>0;
        if(r.need)txt='👶 Enter '+r.need+' for the child dose of '+key(d);
        else if(r.mg)txt='👶 '+(w>0?w+' kg':ageTxt(a))+': '+fmtMg(r.mg,d)+' per dose, '+freqTxt(d,r).toLowerCase()+(r.qtyTxt?' = '+r.qtyTxt+' of '+fs:'')+(d.type==='kg'?' ('+d.kg[2]+' mg/kg/'+d.per+')':'');
        if(r.warn.length)txt+=(txt?' · ':'')+'⚠ '+r.warn.join('; ')}
      else{var t=TOP.find(function(x){return x[0].test(g)});if(t&&g){bad=!(a>=t[1]);txt=(bad?'⚠ ':'ℹ ')+t[2]}}
      if(!txt)return;var e=document.createElement('div');e.className='pdl'+(bad?' bad':'');e.textContent=txt;row.appendChild(e)})}
  A_.addEventListener('input',render);if(W_)W_.addEventListener('input',function(){st.w=W_.value;render()});
  root.querySelectorAll('#rxM [data-k="g"],#rxM [data-k="s"],#rxM [data-k="f"]').forEach(function(i){i.addEventListener('change',rows)});
  render()}

window.PedDose={DB:DB,TOP:TOP,calc:calc,ageMonths:ageMonths,find:find};
function hook(){if(window.RxPad){RxPad.onDraw=onDraw;return true}return false}
if(!hook())document.addEventListener('DOMContentLoaded',hook);
})();
