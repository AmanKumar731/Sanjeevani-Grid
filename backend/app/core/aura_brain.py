import re
from typing import Dict, List, Optional
from app.models.schemas import Hospital, Patient


DELHI_HOSPITAL_PROFILES = {
    "H-1": {
        "name": "AIIMS New Delhi (All India Institute of Medical Sciences)",
        "kind": "Government Central Apex Teaching Hospital",
        "location": "Ansari Nagar East, Ring Road, South Delhi",
        "specialties": "Level-1 Apex Trauma Centre, Advanced Cardiology, Neurology, Organ Transplants, Critical ICU",
        "emergency_tier": "L5 Resuscitation & Complex Multi-Trauma",
        "description": "India's premier public medical research and tertiary care hospital, featuring the JPN Apex Trauma Centre equipped for the most acute medical resuscitations."
    },
    "H-2": {
        "name": "Safdarjung Hospital & VMMC",
        "kind": "Government Central Multi-Specialty Hospital",
        "location": "Opposite AIIMS, Ring Road, South Delhi",
        "specialties": "Dedicated National Burns Care Centre, Multi-Trauma Emergency, High-Volume Acute Resuscitation, Orthopedics",
        "emergency_tier": "L4-L5 Severe Multi-Trauma & Burns",
        "description": "One of India's largest public hospitals, home to the Vardhman Mahavir Medical College and the country's most active emergency burn and multi-trauma care wards."
    },
    "H-3": {
        "name": "Dr. Ram Manohar Lohia (RML) Hospital",
        "kind": "Government Central Referral Hospital",
        "location": "Baba Kharak Singh Marg, Connaught Place, Central Delhi",
        "specialties": "Interventional Cardiology, 24/7 Stroke Unit, Medical Emergencies, VVIP Central Referral",
        "emergency_tier": "L4-L5 Cardiac, Stroke & Medical Emergencies",
        "description": "A historic central government hospital near Connaught Place providing rapid emergency response for central Delhi."
    },
    "H-4": {
        "name": "Lok Nayak Hospital (LNJP / MAMC)",
        "kind": "Government State Academic Hospital",
        "location": "Delhi Gate, Jawaharlal Nehru Marg, Central-North Delhi",
        "specialties": "General Trauma, Infectious Disease Resuscitation, Pediatric Emergencies, General Surgery",
        "emergency_tier": "L3-L5 Acute Infectious, Surgical & Trauma Care",
        "description": "Affiliated with Maulana Azad Medical College (MAMC), LNJP is the largest Delhi Government tertiary hospital, serving central and north Delhi."
    },
    "H-5": {
        "name": "Guru Teg Bahadur (GTB) Hospital",
        "kind": "Government State Academic Hospital",
        "location": "Dilshad Garden, Shahdara, East Delhi / Trans-Yamuna",
        "specialties": "Trauma, Emergency Medicine, Respiratory Emergencies, Acute Medical Care",
        "emergency_tier": "L3-L5 East Delhi Tertiary Trauma Hub",
        "description": "Associated with University College of Medical Sciences (UCMS), GTB Hospital serves as the primary emergency healthcare lifeline for the Trans-Yamuna region."
    },
    "H-6": {
        "name": "Max Super Speciality Hospital, Saket",
        "kind": "Private Quaternary Super-Specialty Hospital",
        "location": "1-2 Press Enclave Marg, Saket, South Delhi",
        "specialties": "Robotic Surgery, Comprehensive Cardiac Emergency, Neuro-ICU, Advanced Oncology",
        "emergency_tier": "L4-L5 Advanced Private Trauma & Interventional Cardiology",
        "description": "A premier NABH/JCI accredited private quaternary medical center with advanced Cath Labs and 24/7 critical care emergency teams."
    },
    "H-7": {
        "name": "Fortis Escorts Heart Institute",
        "kind": "Private Cardiac Apex Hospital",
        "location": "Okhla Road, Sukhdev Vihar, South-East Delhi",
        "specialties": "Interventional Cardiology, Emergency Angioplasty, Cardiac Arrest Resuscitation, ECMO",
        "emergency_tier": "L5 Dedicated Cardiac Resuscitation Hub",
        "description": "World-renowned cardiac specialty hospital offering immediate emergency catheterization and advanced mechanical circulatory support."
    },
    "H-8": {
        "name": "Indraprastha Apollo Hospital",
        "kind": "Private Multi-Specialty Quaternary Hospital",
        "location": "Delhi-Mathura Road, Sarita Vihar, South-East Delhi",
        "specialties": "Level-1 Private Trauma, Multi-Organ Transplants, Pediatric Intensive Care, Stroke Emergency",
        "emergency_tier": "L4-L5 Quaternary Multi-Specialty Trauma",
        "description": "Spanning over 15 acres, Apollo Delhi provides comprehensive emergency facilities including air-ambulance helipad and multi-disciplinary trauma teams."
    },
    "H-9": {
        "name": "Sir Ganga Ram Hospital",
        "kind": "Private Multi-Specialty Tertiary Trust Hospital",
        "location": "Sir Ganga Ram Hospital Marg, Old Rajinder Nagar, West-Central Delhi",
        "specialties": "Critical Care Medicine, Nephrology, Interventional Radiology, Emergency Surgery",
        "emergency_tier": "L4-L5 Comprehensive Tertiary Emergency",
        "description": "A premier non-profit trust hospital in central-west Delhi with 675+ total beds and a renowned emergency critical care division."
    },
    "H-10": {
        "name": "Deen Dayal Upadhyay (DDU) Hospital",
        "kind": "Local / Community Government Hospital",
        "location": "Clock Tower, Hari Nagar, West Delhi",
        "specialties": "Secondary Trauma, Acute Medical Care, Road Accident First Response, General Surgery",
        "emergency_tier": "L2-L4 West Delhi First Responder Hospital",
        "description": "A high-capacity 640-bed Delhi government hospital serving as the primary local acute care facility for West Delhi."
    },
    "H-11": {
        "name": "Sanjay Gandhi Memorial Hospital",
        "kind": "Local / Community Government Hospital",
        "location": "Block S, Mangolpuri, North-West Delhi",
        "specialties": "Community Emergency Care, Acute Pediatric, Minor Trauma, Orthopedic Stabilization",
        "emergency_tier": "L2-L4 Outer Delhi Community Emergency",
        "description": "Provides crucial secondary emergency services for Outer and North-West Delhi, stabilizing acute patients and handling road emergencies."
    },
    "H-12": {
        "name": "Acharya Shree Bhikshu Government Hospital",
        "kind": "Local / Community Municipal Hospital",
        "location": "Moti Nagar, West Delhi",
        "specialties": "Community Acute Care, Outpatient ER, Pediatric & Maternal Emergency, Minor Trauma",
        "emergency_tier": "L1-L3 Local Urgent Care Center",
        "description": "A community-level emergency healthcare facility focused on rapid diagnosis, local acute care, and patient triage."
    },
    "H-13": {
        "name": "Lal Bahadur Shastri Hospital",
        "kind": "Local / Community Government Hospital",
        "location": "Khichripur, Mayur Vihar Phase-II, East Delhi",
        "specialties": "Community Emergency, Road Accident First Response, Acute Medical Intake",
        "emergency_tier": "L2-L4 East Delhi Community Hospital",
        "description": "Serves eastern Delhi neighborhoods with 24/7 casualty, maternal emergency, and community triage capabilities."
    },
}


def build_aura_system_prompt(hospitals: Dict[str, Hospital]) -> str:
    """Builds an exhaustive, context-aware system prompt for Aura."""
    hospital_status_lines = []
    for hid, h in hospitals.items():
        avail = h.available_beds
        total = h.total_beds
        wait = round(h.current_wait_time_mins)
        q_len = h.active_queue_length
        kind = h.kind.upper()
        hospital_status_lines.append(
            f"- {h.name} [{hid}] ({kind}): {avail}/{total} beds available, Queue: {q_len} patients, Est. Wait: {wait}m, Lat: {h.lat}, Lng: {h.lng}"
        )
    
    status_summary = "\n".join(hospital_status_lines)

    return f"""You are Aura, the advanced AI Command Assistant for Sanjeevani Grid (संजीवनी) – Delhi NCR's live emergency medical dispatch and hospital capacity orchestration platform.

YOUR IDENTITY & ROLE:
- You are knowledgeable, highly professional, clinical yet accessible, and deeply technical about emergency healthcare in Delhi, India.
- You assist medical dispatchers, emergency operators, and healthcare administrators.
- You provide precise answers about this website (Sanjeevani Grid), its algorithms (MTS Triage, PTT Routing, APQH Dynamic Priority Queues), and comprehensive facts about Delhi's healthcare network (Government, Private, and Local hospitals).

SANJEEVANI GRID PLATFORM OVERVIEW:
- Purpose: Real-time emergency healthcare flow orchestration for the National Capital Territory of Delhi, India.
- Live Map: Leaflet GIS map with street tiles and clean canvas options, plotting 13 Delhi hospitals, active ambulances, and transit corridors without any API key limitations.
- Triage Engine: Rule-based Manchester Triage System (MTS) categorizing into L1 (Non-urgent), L2 (Standard), L3 (Urgent), L4 (Very Urgent), and L5 (Immediate Resuscitation).
- Predictive Routing (PTT): Evaluates PTT = Travel Time + Queue Wait Time + Patient Deterioration Risk. Dynamically routes high-acuity patients to apex centers like AIIMS or Safdarjung while distributing routine cases to community facilities.
- APQH Dynamic Priority Queues: Periodically sorts emergency queues so deteriorating patients bypass static first-in-first-out wait lists.
- Real-Time Updates: Bi-directional WebSocket stream (`/ws/dashboard`) and REST APIs in Python FastAPI with React/Vite TanStack frontend.

LIVE DELHI HOSPITAL GRID STATE:
{status_summary}

DELHI HOSPITAL CLASSIFICATION GUIDE:
1. Government Academic Apex Hospitals (Public):
   - AIIMS New Delhi (Ansari Nagar, apex trauma and organ transplant)
   - Safdarjung Hospital & VMMC (Ring Road, national burns center and high-volume multi-trauma)
   - Dr. RML Hospital (Connaught Place, central cardiac and medical emergency)
   - Lok Nayak Hospital / LNJP (Delhi Gate, MAMC teaching hospital, infectious/trauma hub)
   - GTB Hospital (Dilshad Garden, Trans-Yamuna tertiary emergency lifeline)
2. Private Super-Specialty Hospitals:
   - Max Super Speciality Saket (quaternary trauma, neuro-ICU)
   - Fortis Escorts Heart Institute Okhla (cardiac resuscitation and emergency angioplasty)
   - Indraprastha Apollo Sarita Vihar (comprehensive trauma, helipad air ambulance)
   - Sir Ganga Ram Hospital Rajinder Nagar (premier trust tertiary emergency)
3. Local Community & Municipal Hospitals:
   - Deen Dayal Upadhyay (DDU) Hospital (Hari Nagar, West Delhi acute emergency)
   - Sanjay Gandhi Memorial Hospital (Mangolpuri, Outer North-West emergency)
   - Acharya Shree Bhikshu Hospital (Moti Nagar, West Delhi community care)
   - Lal Bahadur Shastri Hospital (Khichripur, East Delhi community casualty)

Always respond with precision, clear markdown formatting, bullet points, and actionable emergency dispatch insights.
"""


def generate_aura_expert_response(
    query: str,
    hospitals: Dict[str, Hospital],
    queues: Dict[str, List[Patient]],
    patients: Dict[str, Patient],
) -> str:
    """
    Intelligent domain expert reasoning engine for Aura.
    Evaluates semantic intent and crafts comprehensive, live-aware answers.
    """
    q = query.lower().strip()

    # --- 1. GREETINGS & WHO ARE YOU ---
    if re.search(r"\b(hello|hi|hey|greetings|namaste|who are you|what can you do|about you)\b", q):
        return (
            "**Namaste! I am Aura**, your AI Command Assistant for **Sanjeevani Grid (संजीवनी) – Delhi NCR**.\n\n"
            "I monitor emergency operations across **13 major hospitals in Delhi**, including:\n"
            "* **Government Hospitals**: AIIMS New Delhi, Safdarjung, Dr. RML, LNJP, GTB\n"
            "* **Private Super-Specialty**: Max Saket, Fortis Escorts, Apollo Indraprastha, Sir Ganga Ram\n"
            "* **Local Community Hospitals**: DDU Hospital, Sanjay Gandhi Memorial, Acharya Bhikshu, LBS Hospital\n\n"
            "**Here is what you can ask me:**\n"
            "1. *'Which hospital has available beds in Delhi right now?'*\n"
            "2. *'Where should I send a severe cardiac arrest patient in South Delhi?'*\n"
            "3. *'Tell me about AIIMS New Delhi or Safdarjung Hospital'*\n"
            "4. *'How does Sanjeevani Grid's predictive routing and triage work?'*\n"
            "5. *'What are the local community clinics available?'*"
        )

    # --- 2. ABOUT THIS WEBSITE / SANJEEVANI GRID ---
    if re.search(r"\b(website|sanjeevani|pulsegrid|project|platform|what is this|system|architecture|hackathon|features)\b", q):
        return (
            "### 🏥 About Sanjeevani Grid (संजीवनी) — Delhi NCR Medical Command\n\n"
            "**Sanjeevani Grid** is a real-time emergency healthcare orchestration platform designed to eliminate emergency response delays across the **National Capital Territory of Delhi**.\n\n"
            "#### Key Pillars:\n"
            "1. **Live Geographic Grid**:\n"
            "   * Real-time interactive Leaflet map centered on Delhi NCR with street and clean canvas tile modes.\n"
            "   * Tracks simulated 108/CATS ambulances and dynamically draws routing vectors.\n"
            "2. **Explainable Triage Engine**:\n"
            "   * Implements the **Manchester Triage System (MTS)** scoring patients from **L1 (Non-urgent)** to **L5 (Immediate Resuscitation)** based on chief symptoms and clinical acuity.\n"
            "3. **Predictive Hospital Routing (PTT)**:\n"
            "   * Calculates optimal destination based on: `PTT = Travel Time + Queue Wait + Deterioration Risk`.\n"
            "4. **Dynamic Priority Queues (APQH)**:\n"
            "   * Periodically re-orders hospital waiting lists so that deteriorating patients bypass static first-in-first-out bottlenecks.\n"
            "5. **Full Delhi Healthcare Spectrum**:\n"
            "   * 13 integrated facilities covering **Government Central Apex**, **Private Quaternary**, and **Local Municipal Community** units.\n"
            "6. **Event-Driven Backend**:\n"
            "   * FastAPI Python engine streaming live state via WebSockets (`/ws/dashboard`) to a React/Vite dashboard."
        )

    # --- 3. AVAILABLE BEDS / CAPACITY QUERIES ---
    if re.search(r"\b(available beds?|bed status|capacity|how many beds|free beds?|occupancy|congested|full)\b", q):
        total_beds = sum(h.total_beds for h in hospitals.values())
        total_avail = sum(h.available_beds for h in hospitals.values())
        occupancy = round(((total_beds - total_avail) / total_beds) * 100) if total_beds > 0 else 0

        # Sort hospitals by available beds descending
        sorted_by_avail = sorted(hospitals.values(), key=lambda h: h.available_beds, reverse=True)
        top_available = sorted_by_avail[:5]

        lines = [
            f"### 🛏️ Delhi NCR Real-Time Bed Availability\n",
            f"Across the Delhi network, **{total_avail} of {total_beds} beds** are currently available (**{occupancy}% network occupancy**).\n",
            "**Top Facilities with Immediate Bed Availability:**",
        ]
        for h in top_available:
            kind_str = "Government" if h.kind == "public" else "Private" if h.kind == "private" else "Local Community"
            lines.append(f"* **{h.name}** ({kind_str}): **{h.available_beds}/{h.total_beds} beds free** · Wait: ~{round(h.current_wait_time_mins)}m · Queue: {h.active_queue_length}")

        return "\n".join(lines)

    # --- 4. GOVERNMENT / PUBLIC HOSPITALS QUERY ---
    if re.search(r"\b(government|public|sarkari|central|aiims|safdarjung|rml|lnjp|gtb)\b", q) and not re.search(r"\b(private|local)\b", q):
        return (
            "### 🏛️ Government & Academic Teaching Hospitals in Delhi\n\n"
            "Delhi hosts some of India's finest apex public institutions monitored by Sanjeevani Grid:\n\n"
            "1. **AIIMS New Delhi (Ansari Nagar East, Ring Road)**:\n"
            "   * *Capacity*: 50 emergency grid beds.\n"
            "   * *Focus*: Apex Level-1 Trauma Centre, cardiac arrest, neuro-resuscitation, organ failure.\n"
            "2. **Safdarjung Hospital & VMMC (Ring Road)**:\n"
            "   * *Capacity*: 44 emergency grid beds.\n"
            "   * *Focus*: National Burns Care Centre, high-velocity multi-trauma, mass casualty care.\n"
            "3. **Dr. Ram Manohar Lohia (RML) Hospital (Connaught Place)**:\n"
            "   * *Capacity*: 36 emergency grid beds.\n"
            "   * *Focus*: Central Delhi acute medical emergencies, interventional cardiology, 24/7 stroke care.\n"
            "4. **Lok Nayak Hospital (LNJP / MAMC, Delhi Gate)**:\n"
            "   * *Capacity*: 38 emergency grid beds.\n"
            "   * *Focus*: Major municipal trauma center, infectious resuscitation, acute pediatric and surgical care.\n"
            "5. **Guru Teg Bahadur (GTB) Hospital (Dilshad Garden, East Delhi)**:\n"
            "   * *Capacity*: 34 emergency grid beds.\n"
            "   * *Focus*: Primary tertiary emergency lifeline for East Delhi and Trans-Yamuna."
        )

    # --- 5. PRIVATE SUPER-SPECIALTY HOSPITALS QUERY ---
    if re.search(r"\b(private|max|fortis|apollo|ganga ram|corporate)\b", q):
        return (
            "### 🏥 Private Super-Specialty Trauma & Cardiac Centers in Delhi\n\n"
            "Sanjeevani Grid monitors Delhi's leading private quaternary trauma facilities for load balancing:\n\n"
            "1. **Max Super Speciality Hospital, Saket (South Delhi)**:\n"
            "   * *Capacity*: 28 emergency beds.\n"
            "   * *Focus*: Advanced cardiac catheterization, 24/7 Neuro-ICU, acute oncology & robotic trauma care.\n"
            "2. **Fortis Escorts Heart Institute (Okhla Road, South-East Delhi)**:\n"
            "   * *Capacity*: 24 dedicated cardiac beds.\n"
            "   * *Focus*: World-class emergency angioplasty, ECMO support, cardiac arrest resuscitation.\n"
            "3. **Indraprastha Apollo Hospital (Sarita Vihar, Mathura Road)**:\n"
            "   * *Capacity*: 30 emergency beds.\n"
            "   * *Focus*: Quaternary multi-organ trauma, helipad air-ambulance intake, pediatric intensive care.\n"
            "4. **Sir Ganga Ram Hospital (Rajinder Nagar, West-Central Delhi)**:\n"
            "   * *Capacity*: 26 emergency beds.\n"
            "   * *Focus*: Premier charitable trust hospital with comprehensive multi-disciplinary intensive care."
        )

    # --- 6. LOCAL / COMMUNITY CLINICS QUERY ---
    if re.search(r"\b(local|community|clinic|municipal|ddu|deen dayal|sanjay gandhi|bhikshu|lal bahadur|lbs)\b", q):
        return (
            "### 🏥 Local Community & Municipal Hospitals in Delhi\n\n"
            "Local community hospitals handle urgent routine cases (L1-L3), preventing tertiary apex centers from becoming overwhelmed:\n\n"
            "1. **Deen Dayal Upadhyay (DDU) Hospital (Hari Nagar, West Delhi)**:\n"
            "   * *Capacity*: 22 emergency beds.\n"
            "   * *Focus*: Primary road trauma first responder for West Delhi, orthopedic stabilization, acute medical intake.\n"
            "2. **Sanjay Gandhi Memorial Hospital (Mangolpuri, North-West Delhi)**:\n"
            "   * *Capacity*: 20 emergency beds.\n"
            "   * *Focus*: Community emergency lifeline for Outer Delhi, pediatric emergencies, minor surgical casualty.\n"
            "3. **Acharya Shree Bhikshu Government Hospital (Moti Nagar, West Delhi)**:\n"
            "   * *Capacity*: 18 emergency beds.\n"
            "   * *Focus*: Local community urgent care, outpatient emergency stabilization, maternal health.\n"
            "4. **Lal Bahadur Shastri (LBS) Hospital (Khichripur, East Delhi)**:\n"
            "   * *Capacity*: 18 emergency beds.\n"
            "   * *Focus*: 24/7 casualty first response, fracture management, and acute community triage."
        )

    # --- 7. CARDIAC EMERGENCY / HEART ATTACK ROUTING ---
    if re.search(r"\b(cardiac|heart|chest pain|angina|infarction|ecg|heart attack)\b", q):
        return (
            "### 🚨 Clinical Dispatch Protocol: Acute Cardiac Emergency\n\n"
            "For a patient presenting with **severe crushing chest pain radiating to the left arm and sweating (L5 Immediate)**:\n\n"
            "**Primary Recommended Centers in Delhi:**\n"
            "1. **Fortis Escorts Heart Institute (Okhla)**: Immediate Primary Percutaneous Coronary Intervention (PPCI) with door-to-balloon time <60 mins.\n"
            "2. **AIIMS New Delhi (Ansari Nagar)**: Dedicated 24/7 Emergency Cardiac Care and Cath Lab facility.\n"
            "3. **Dr. Ram Manohar Lohia (RML) Hospital (Connaught Place)**: Apex central Delhi interventional cardiac emergency unit.\n"
            "4. **Max Super Speciality Hospital (Saket)**: Rapid south Delhi interventional cardiology.\n\n"
            "**Algorithm Decision**: The PTT engine checks real-time Cath Lab availability and routes to the nearest center with available ICU beds to prevent myocardial infarction damage."
        )

    # --- 8. STROKE / NEURO EMERGENCY ROUTING ---
    if re.search(r"\b(stroke|paralysis|slurred speech|facial droop|hemiparesis|brain|neuro)\b", q):
        return (
            "### 🧠 Clinical Dispatch Protocol: Acute Ischemic Stroke\n\n"
            "**Time is Brain**: For acute stroke with onset <4.5 hours:\n\n"
            "**Top Stroke-Ready Centers in Delhi:**\n"
            "1. **AIIMS New Delhi**: Comprehensive 24/7 CT Angiography, IV Thrombolysis & Mechanical Thrombectomy.\n"
            "2. **Sir Ganga Ram Hospital (Rajinder Nagar)**: Dedicated acute Stroke Code pathway.\n"
            "3. **Max Super Speciality Hospital (Saket)**: 24/7 Neuro-interventionist coverage.\n"
            "4. **Indraprastha Apollo (Sarita Vihar)**: Advanced stroke care and emergency neurovascular surgery.\n\n"
            "**Sanjeevani Grid Action**: The ambulance pre-notifies the CT suite so the patient is scanned immediately upon arrival."
        )

    # --- 9. ACCIDENT / ROAD TRAUMA ROUTING ---
    if re.search(r"\b(accident|collision|trauma|head injury|fracture|bleeding|injury)\b", q):
        return (
            "### 🚑 Clinical Dispatch Protocol: Severe Vehicular Trauma\n\n"
            "For severe polytrauma, head injury, or arterial bleeding:\n\n"
            "**Primary Level-1 Trauma Hubs in Delhi:**\n"
            "* **AIIMS JPN Apex Trauma Centre (Ring Road)**: The national benchmark for multi-specialty trauma resuscitation.\n"
            "* **Safdarjung Hospital (Ring Road)**: Dedicated trauma and emergency burn resuscitation center.\n"
            "* **Lok Nayak Hospital / LNJP (Delhi Gate)**: High-capacity surgical casualty and trauma resuscitation.\n"
            "* **Deen Dayal Upadhyay (DDU) Hospital (Hari Nagar)**: West Delhi highway and road trauma hub.\n"
            "* **Guru Teg Bahadur (GTB) Hospital (Dilshad Garden)**: East Delhi primary trauma receiving hospital."
        )

    # --- 10. HOW TRIAGE WORKS ---
    if re.search(r"\b(triage|mts|levels?|l1|l2|l3|l4|l5|scoring)\b", q):
        return (
            "### ⚖️ Explainable Triage: Manchester Triage System (MTS)\n\n"
            "Sanjeevani Grid automatically scores patient symptoms into 5 clinical tiers:\n\n"
            "* 🔴 **Level 5 · Immediate Resuscitation (0 mins)**: Immediate threat to life (e.g., cardiac arrest, respiratory failure, major arterial hemorrhage).\n"
            "* 🟠 **Level 4 · Very Urgent (<15 mins)**: High clinical acuity (e.g., severe chest pain, acute stroke, unconsciousness, severe vehicular trauma).\n"
            "* 🟡 **Level 3 · Urgent (<30 mins)**: Moderate emergency (e.g., severe asthma, compound fractures, severe abdominal pain).\n"
            "* 🔵 **Level 2 · Standard (<60 mins)**: Stable condition requiring hospital attention (e.g., persistent high fever, minor fractures, lacerations).\n"
            "* ⚪ **Level 1 · Non-Urgent (<120 mins)**: Routine minor conditions suitable for community health centers."
        )

    # --- 11. HOW PREDICTIVE ROUTING (PTT) WORKS ---
    if re.search(r"\b(routing|ptt|algorithm|how does routing work|formula|destination)\b", q):
        return (
            "### 🧭 Predictive Transit-Time (PTT) Routing Algorithm\n\n"
            "Sanjeevani Grid routes ambulances using a multi-factor clinical optimization formula:\n\n"
            "```text\n"
            "PTT = T_travel + (T_queue × Congestion_Multiplier) + R_deterioration\n"
            "```\n\n"
            "**Where:**\n"
            "1. **`T_travel`**: Estimated ambulance transit time calculated based on Delhi GIS coordinates and average speed.\n"
            "2. **`T_queue`**: Estimated waiting time at the emergency department, dynamically inflated by the hospital's bed occupancy score `C_h = (Queue + Incoming) / Total_Beds`.\n"
            "3. **`R_deterioration`**: Clinical penalty applied for high-acuity patients (L4-L5). A deteriorating patient cannot afford an extra 15-minute drive, so nearby centers are prioritized."
        )

    # --- 12. HOW APQH PRIORITY QUEUES WORK ---
    if re.search(r"\b(queue|apqh|priority queue|re-order|waiting list)\b", q):
        return (
            "### ⚡ APQH Dynamic Priority Queue Management\n\n"
            "Traditional emergency rooms operate on static first-come, first-served (FIFO) lines, which can lead to preventable clinical deterioration.\n\n"
            "**Sanjeevani Grid's APQH Formula:**\n"
            "```text\n"
            "Priority Score = (Severity_Weight × 20) + (Elapsed_Wait_Time × λ) + Deterioration_Rate\n"
            "```\n\n"
            "Every 2 seconds, the system re-evaluates all queued patients across Delhi hospitals. If a Level-4 patient has been waiting, their score accelerates rapidly, ensuring they move ahead of non-urgent patients before adverse outcomes occur."
        )

    # --- 13. SPECIFIC HOSPITAL LOOKUP ---
    for hid, profile in DELHI_HOSPITAL_PROFILES.items():
        if hid.lower() in q or profile["name"].lower() in q:
            h = hospitals.get(hid)
            status_text = ""
            if h:
                status_text = f"\n* **Current Available Beds**: **{h.available_beds}/{h.total_beds}**\n* **Active Queue**: {h.active_queue_length} patients\n* **Est. Wait Time**: ~{round(h.current_wait_time_mins)} mins"
            
            return (
                f"### 🏥 {profile['name']}\n\n"
                f"* **Category**: {profile['kind']}\n"
                f"* **Location**: {profile['location']}\n"
                f"* **Specialties**: {profile['specialties']}\n"
                f"* **Acuity Level**: {profile['emergency_tier']}\n"
                f"{status_text}\n\n"
                f"{profile['description']}"
            )

    # --- 14. DEFAULT INTELLIGENT SYNTHESIS ---
    total_beds = sum(h.total_beds for h in hospitals.values())
    total_avail = sum(h.available_beds for h in hospitals.values())
    return (
        f"### ⚡ Delhi Emergency Command Intelligence\n\n"
        f"I analyzed your inquiry: *\"{query}\"*.\n\n"
        f"**Live Network Summary**:\n"
        f"* **Network**: 13 hospitals across Government, Private, and Local tiers in Delhi NCR.\n"
        f"* **Bed Availability**: {total_avail} of {total_beds} emergency beds free right now.\n"
        f"* **Dispatch Status**: 108/CATS emergency ambulances routing dynamically with MTS Triage and PTT optimization.\n\n"
        f"**Key Capabilities You Can Query:**\n"
        f"* **Hospital Capacity**: *'Which hospital has the shortest wait time in Delhi?'*\n"
        f"* **Specialty Care**: *'Best hospital for pediatric emergencies or severe road accident?'*\n"
        f"* **Algorithms**: *'How does PTT routing prevent hospital congestion?'*\n"
        f"* **Institutions**: *'Details on AIIMS, Safdarjung, Max Saket, or DDU Hospital.'*"
    )
