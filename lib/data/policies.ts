/**
 * Statutory policy content for the citizen portal — NalamMesh.
 *
 * GIGW 3.0 requires a government portal to publish these pages, and the footer has
 * always linked to them; until now those seven links 404'd. Content is written to
 * describe what this application actually does — notably that health data stays on the
 * device — rather than boilerplate copied from another department's site.
 */

export interface PolicySection {
    heading: string;
    body: string[];
}

export interface PolicyDoc {
    slug: string;
    title: string;
    intro: string;
    sections: PolicySection[];
}

const NODAL = 'Chief Medical Officer, District Health Office, Gadchiroli — Nodal Officer for this portal.';

export const POLICIES: Record<string, PolicyDoc> = {
    privacy: {
        slug: 'privacy',
        title: 'Privacy Policy',
        intro:
            'This portal is operated by the Department of Public Health, Government of Maharashtra under the National Health Mission. This policy explains what data NalamMesh handles and where it is stored.',
        sections: [
            {
                heading: 'Health data stays on the device',
                body: [
                    'NalamMesh is an offline-first application. Patient records, triage results, referrals, appointments and medicine stock are stored locally on the device in the browser database (IndexedDB). They are not uploaded to any cloud service and are not transmitted to any third party.',
                    'Where a facility runs the optional mesh relay, records are exchanged only between facilities of the Maharashtra public health network for continuity of care, and only while that relay is running.',
                ],
            },
            {
                heading: 'Information we do not collect',
                body: [
                    'The portal does not use advertising trackers or third-party analytics. It does not collect personal information from a visitor browsing the public pages, beyond what your browser normally sends to any website.',
                    'No payment information is collected anywhere in this application.',
                ],
            },
            {
                heading: 'Access and accountability',
                body: [
                    'Access to clinical modules is restricted by staff role (ASHA, ANM/CHO, Medical Officer, Specialist, Pharmacist, Lab Technician, District Health Officer). Changes to referrals, queue entries, appointments and medicine stock are recorded in an audit trail with the acting staff identifier and a timestamp.',
                    'The audit trail records the identifier of the record changed, not a duplicate copy of patient identity.',
                ],
            },
            {
                heading: 'Digital Personal Data Protection Act, 2023',
                body: [
                    'Personal health data is processed for the purpose of delivering public healthcare services. Data minimisation is enforced by design: the application stores only the clinical fields required for care, and retains them on the device of the facility that created them.',
                    'For any request concerning your personal data, contact the Nodal Officer listed below.',
                ],
            },
            { heading: 'Contact', body: [NODAL] },
        ],
    },

    terms: {
        slug: 'terms',
        title: 'Terms of Use',
        intro:
            'By using this portal you agree to the terms below. NalamMesh is a public health service delivery tool for Government of Maharashtra facilities and the citizens they serve.',
        sections: [
            {
                heading: 'Clinical decision support, not a diagnosis',
                body: [
                    'The digital triage feature assigns a priority level and recommends a facility tier. It does not diagnose disease and does not replace examination by a registered medical practitioner. All clinical decisions remain with the attending Medical Officer or qualified health worker.',
                    'In an emergency, call 108 (ambulance) or 102 (maternal and child transport) directly. Do not rely on this portal for emergency dispatch.',
                ],
            },
            {
                heading: 'Accuracy of content',
                body: [
                    'Facility details, staffing figures, bed availability and medicine stock reflect the records entered at the facility. While every effort is made to keep them current, they should be confirmed with the facility before travelling.',
                    'Entitlement and scheme information is provided for general awareness. It is not an eligibility determination for any individual. Confirm your entitlement with facility staff.',
                ],
            },
            {
                heading: 'Acceptable use',
                body: [
                    'Staff credentials must not be shared. Access to patient records is limited to the purpose of providing care to that patient.',
                    'Any attempt to gain unauthorised access to records, or to interfere with the operation of the portal, may attract action under applicable law.',
                ],
            },
            { heading: 'Contact', body: [NODAL] },
        ],
    },

    hyperlinking: {
        slug: 'hyperlinking',
        title: 'Hyperlinking Policy',
        intro: 'This policy governs links to and from this portal, in line with GIGW 3.0 guidance.',
        sections: [
            {
                heading: 'Links to external websites',
                body: [
                    'At several places this portal links to websites of other government bodies and national programmes — including the Ayushman Bharat Digital Mission, the National Health Mission, eSanjeevani and the Public Health Department of Maharashtra. These links are provided for your convenience.',
                    'We are not responsible for the content or reliability of external sites, and linking to them should not be taken as an endorsement. We cannot guarantee that such links will work at all times.',
                ],
            },
            {
                heading: 'Links to this portal from elsewhere',
                body: [
                    'Prior permission is not required to link directly to pages hosted on this portal. However, we would like you to inform the Nodal Officer of any such link so that changes can be communicated.',
                    'Our pages must not be loaded into frames on your site. Pages must load into a newly opened browser window belonging to the user.',
                ],
            },
            { heading: 'Contact', body: [NODAL] },
        ],
    },

    copyright: {
        slug: 'copyright',
        title: 'Copyright Policy',
        intro: 'Terms governing reuse of material published on this portal.',
        sections: [
            {
                heading: 'Reproduction of material',
                body: [
                    'Material featured on this portal may be reproduced free of charge in any format or medium, provided it is reproduced accurately and not used in a derogatory manner or in a misleading context.',
                    'Where the material is being published or issued to others, the source must be prominently acknowledged as the Department of Public Health, Government of Maharashtra.',
                ],
            },
            {
                heading: 'Exceptions',
                body: [
                    'Permission to reproduce material does not extend to any material on this portal identified as being the copyright of a third party.',
                    'The State Emblem of India is protected under the State Emblem of India (Prohibition of Improper Use) Act, 2005 and may not be reused.',
                ],
            },
            { heading: 'Contact', body: [NODAL] },
        ],
    },

    accessibility: {
        slug: 'accessibility',
        title: 'Accessibility Statement',
        intro:
            'This portal is built to be usable by the widest possible audience, including people with disabilities and people using low-end devices on slow connections.',
        sections: [
            {
                heading: 'Standards followed',
                body: [
                    'The portal is designed to conform to the Guidelines for Indian Government Websites (GIGW 3.0) and to W3C Web Content Accessibility Guidelines (WCAG) 2.1 Level AA.',
                    'Content is published in English, Hindi (हिन्दी) and Marathi (मराठी). A language selector is available in the header of every page.',
                ],
            },
            {
                heading: 'Accessibility features',
                body: [
                    'A text-size control (A / A+) and a high-contrast mode are available in the header of every page.',
                    'Every page begins with a "Skip to main content" link for keyboard and screen-reader users. Interactive controls are reachable by keyboard and show a visible focus outline.',
                    'Status information is conveyed by text and shape in addition to colour, so it remains readable for users with colour vision deficiency.',
                    'Patient-facing entitlement information can be read aloud using the device speech facility, for users with limited literacy.',
                ],
            },
            {
                heading: 'Known limitations',
                body: [
                    'Some clinical dashboard tables scroll horizontally on very small screens. We are working to improve this.',
                    'If you encounter an accessibility barrier on this portal, please report it through Grievance Redressal so it can be corrected.',
                ],
            },
            { heading: 'Contact', body: [NODAL] },
        ],
    },

    rti: {
        slug: 'rti',
        title: 'Right to Information (RTI 2005)',
        intro:
            'Information relating to this portal and the health services it supports may be sought under the Right to Information Act, 2005.',
        sections: [
            {
                heading: 'How to file a request',
                body: [
                    'An application under Section 6(1) of the Act may be submitted in writing to the Public Information Officer of the District Health Office, Gadchiroli, or filed online through the Government of Maharashtra RTI portal.',
                    'The application should specify the information sought as precisely as possible, and be accompanied by the prescribed fee. Applicants below the poverty line are exempt from the fee on production of proof.',
                ],
            },
            {
                heading: 'Response timelines',
                body: [
                    'Information is ordinarily furnished within 30 days of receipt of the request. Where the information sought concerns the life or liberty of a person, it shall be provided within 48 hours.',
                    'If you are not satisfied with the decision, a first appeal may be filed with the First Appellate Authority within 30 days.',
                ],
            },
            {
                heading: 'Proactive disclosure',
                body: [
                    'Facility-level information published on this portal — the four-tier facility directory, services offered, and citizen entitlements — is available without an RTI request through the Services & Entitlements and Facilities pages.',
                ],
            },
            { heading: 'Contact', body: [NODAL] },
        ],
    },

    feedback: {
        slug: 'feedback',
        title: 'Grievance Redressal',
        intro:
            'If a service was not delivered as it should have been, or you have found a problem with this portal, this page explains how to raise it.',
        sections: [
            {
                heading: 'Health service grievances',
                body: [
                    'Grievances relating to treatment, availability of medicines, behaviour of staff, or denial of an entitlement should be raised first with the Medical Officer in charge of the facility concerned.',
                    'If the matter is not resolved, it may be escalated to the District Health Officer, Gadchiroli, and thereafter through the National Health Mission grievance channel.',
                ],
            },
            {
                heading: 'National helplines',
                body: [
                    'Ambulance: 108 · Maternal and child transport (Janani Shishu): 102 · Health advice: 104 · Mental health (Tele-MANAS): 14477 · Child helpline: 1098.',
                    'These helplines operate 24×7 and are free of charge.',
                ],
            },
            {
                heading: 'Portal defects and accessibility barriers',
                body: [
                    'Problems with this portal — a page that does not load, information that appears incorrect, or an accessibility barrier — should be reported to the Nodal Officer with the page address and a description of what happened.',
                ],
            },
            { heading: 'Contact', body: [NODAL] },
        ],
    },
};

export const POLICY_SLUGS = Object.keys(POLICIES);
