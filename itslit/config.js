/* ItsLit settings: the one file to edit to switch features on (see README.md in this folder).
   Everything here is safe to be public: Firebase web settings are not secrets, and the AI key lives in the Worker.
   Edit it on github.com with the pencil icon and commit; the live site updates in a minute or two. */
window.ITSLIT_CONFIG = {
  // 1. Reader accounts, the Salon, synced shelves, waitlists, Gazette sign-ups and the Writing desk (Firebase).
  //    Paste the values from Firebase console → Project settings → Your apps → Web app → SDK setup and configuration.
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  },

  // 2. The Gazette's editors: their sign-in emails, lower case. Put the same emails in server/firestore.rules.
  editors: [],

  // 3. Free questions to Shelley per reader per day. Shelley switches on by herself once the AI workflow has run.
  dailyLimit: 5,

  // 4. Newsletter sign-ups: 'firebase' keeps them in your database (the Writing desk lists them, ready to import into
  //    beehiiv or any email service); 'beehiiv' sends them straight to beehiiv through the Worker.
  newsletter: 'firebase',

  // 5. Payments: Stripe Payment Link addresses (https://buy.stripe.com/...). Leave blank to show "Join the list".
  stripe: {
    patronMonthly: '',
    patronYearly: '',
    founding: '',
    familyMonthly: '',
    familyYearly: ''
  },

  // 6. Your own web address once you have one, e.g. 'https://www.itslitclub.com' (lets Shelley answer there too).
  customDomain: '',

  // 7. The contact email shown in the privacy notice.
  contactEmail: ''
};
