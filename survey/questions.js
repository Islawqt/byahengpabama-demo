// The instruments in Appendix E of the paper.

export const ROLES = [
    { value: 'Passenger', label: 'Passenger', hint: 'You ride Pabama buses.' },
    { value: 'Line Inspector', label: 'Line Inspector', hint: 'You report buses at a checkpoint.' },
    { value: 'Admin staff', label: 'Pabama admin staff', hint: 'You work in the Pabama office.' },
    { value: 'IT practitioner', label: 'IT practitioner', hint: 'You work or teach in IT.' },
];

// Which parts each role answers (Chapter 3).
export const PARTS = {
    Passenger: { iso: false, sus: true },
    'Line Inspector': { iso: true, sus: true },
    'Admin staff': { iso: true, sus: true },
    'IT practitioner': { iso: true, sus: false },
};

const DEMO = '../';

export const TASKS = {
    Passenger: {
        steps: [
            'Find the next bus to your stop and how much the fare is.',
            'Open the latest announcement.',
        ],
        link: `${DEMO}passenger.html`,
    },
    'Line Inspector': {
        steps: [
            'Log in with a Line Inspector account.',
            'Report a bus at your checkpoint.',
            'Find that report in your list for today.',
        ],
        link: `${DEMO}login.html`,
        account: 'inspector1@demo.test',
    },
    'Admin staff': {
        steps: [
            'Log in with the admin account.',
            'Post an announcement.',
            'Add a fare schedule.',
            'Find the latest report on the dashboard.',
        ],
        link: `${DEMO}login.html`,
        account: 'admin@demo.test',
    },
    'IT practitioner': {
        steps: [
            'Try the passenger tasks: find the next bus to a stop and its fare, then open an announcement.',
            'Log in as a Line Inspector and report a bus.',
            'Log in as the admin, post an announcement, and add a fare schedule.',
            'Review the installation guide (Appendix B of the paper, shared by the proponents).',
        ],
        link: `${DEMO}index.html`,
        account: 'admin@demo.test or inspector1@demo.test',
    },
};

export const ISO = [
    ['Functional suitability', 'The system provides the functions needed to track buses, show fares, post announcements, and manage records.'],
    ['Functional suitability', 'The arrival estimates and fares shown by the system are correct.'],
    ['Functional suitability', 'The functions of the system help me finish my tasks.'],
    ['Performance efficiency', 'Pages open quickly, even on mobile data.'],
    ['Performance efficiency', 'Saving a report or a record takes only a moment.'],
    ['Compatibility', 'The system works on the phones, computers, and browsers I use.'],
    ['Compatibility', 'The system works the same in the browser and in the Android app.'],
    ['Usability', 'I can learn to use the system without training.'],
    ['Usability', 'The pages are clear and easy to read on a phone screen.'],
    ['Usability', 'The system helps me avoid and correct mistakes, for example by confirming each report.'],
    ['Reliability', 'The system works without errors during normal use.'],
    ['Reliability', 'The system tells me when the information shown may be out of date.'],
    ['Security', 'Only authorized staff can open the reporting and admin pages.'],
    ['Security', 'The system records who filed each report and does not ask passengers for personal information.'],
    ['Maintainability', 'Fares, routes, buses, and accounts can be updated without changing the code.'],
    ['Maintainability', 'The system is organized so that errors can be found and fixed easily.'],
    ['Portability', 'The system can be installed on a laptop or a web host by following the installation guide.'],
    ['Portability', 'The system can be used on different devices without installing anything.'],
];

// System Usability Scale (Brooke, 1996).
export const SUS = [
    'I think that I would like to use this system frequently.',
    'I found the system unnecessarily complex.',
    'I thought the system was easy to use.',
    'I think that I would need the support of a technical person to be able to use this system.',
    'I found the various functions in this system were well integrated.',
    'I thought there was too much inconsistency in this system.',
    'I would imagine that most people would learn to use this system very quickly.',
    'I found the system very cumbersome to use.',
    'I felt very confident using the system.',
    'I needed to learn a lot of things before I could get going with this system.',
];

export const OPEN = [
    ['q1', 'What did you find most useful in ByahengPabama?'],
    ['q2', 'What was difficult or confusing when you used it?'],
    ['q3', 'What would you add or change in the system?'],
];

export const SCALE = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];
