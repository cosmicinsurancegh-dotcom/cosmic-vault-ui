export type FaqCategory =
  | "Quotes and applications"
  | "Policies and coverage"
  | "Payments and billing"
  | "Claims"
  | "Accounts and security"
  | "Renewals and changes";

export type Faq = {
  category: FaqCategory;
  question: string;
  answer: string;
};

export const FAQ_CATEGORIES: FaqCategory[] = [
  "Quotes and applications",
  "Policies and coverage",
  "Payments and billing",
  "Claims",
  "Accounts and security",
  "Renewals and changes",
];

export const FAQS: Faq[] = [
  {
    category: "Quotes and applications",
    question: "Is the price I see a binding quote?",
    answer:
      "No. Any figure produced online is an indicative premium calculated from the published rating rules for that product. Cover only begins once an underwriter has reviewed the application, the premium is confirmed, the payment clears, and a policy is issued.",
  },
  {
    category: "Quotes and applications",
    question: "Do I need an account to get a quotation?",
    answer:
      "You can send us a quote request with just your name and email address. Holding a quotation against your record, converting it into an application, and uploading documents all happen in the member vault, so you will be asked to sign in at that point.",
  },
  {
    category: "Quotes and applications",
    question: "How long does a quotation stay valid?",
    answer:
      "Quotations are held on your record for the validity period shown on the quotation itself. After that, the product version or rating rules may have changed and a new quotation is needed.",
  },
  {
    category: "Quotes and applications",
    question: "What information will I be asked for?",
    answer:
      "Each product has its own question set. In practice you will be asked about the thing being insured - a property, a vehicle, travellers, a business - plus anything that materially changes the risk, such as previous claims or declared conditions. Answer honestly: undisclosed facts affect claims later.",
  },
  {
    category: "Quotes and applications",
    question: "Can someone apply on my behalf?",
    answer:
      "Yes, through a broker who holds an active assignment for you. Brokers record your consent before preparing a quotation in your name, and the resulting records stay visible to you in your own vault.",
  },
  {
    category: "Policies and coverage",
    question: "Where do I find what my policy actually covers?",
    answer:
      "Your policy documents are held in the vault. The schedule states the limits, excess, and period; the wording sets out the detail, including exclusions and the conditions you must meet.",
  },
  {
    category: "Policies and coverage",
    question: "What is an excess?",
    answer:
      "The first part of a claim that you pay. It is shown on your schedule, and different sections of a policy can carry different excesses.",
  },
  {
    category: "Policies and coverage",
    question: "Why do exclusions exist?",
    answer:
      "An insurance policy cannot price every outcome, so it states clearly what is not covered. Reading the exclusions before you buy is far more useful than reading the marketing summary afterwards.",
  },
  {
    category: "Policies and coverage",
    question: "Can I add something that is not part of the standard cover?",
    answer:
      "Some optional benefits can be added during the application or by endorsement afterwards, if the product version supports them. Where a change is not available, we say so rather than leaving you to discover it at claim time.",
  },
  {
    category: "Payments and billing",
    question: "How is my premium paid?",
    answer:
      "Premium payments are recorded against the policy or application, with the method and status visible in the payments area of your vault. When a payment is pending you can see the reference and, where applicable, the bank details as configured by the operator.",
  },
  {
    category: "Payments and billing",
    question: "What happens if a payment fails?",
    answer:
      "The transaction is marked as failed with the reason recorded, and a notification is raised so you can act. A policy that depends on an unpaid premium will not be treated as active until the payment is resolved.",
  },
  {
    category: "Payments and billing",
    question: "How do refunds work?",
    answer:
      "Refunds are recorded as separate transactions linked to the original payment, and only after they are approved. Nothing is refunded automatically, and any refund appears in your payment history.",
  },
  {
    category: "Payments and billing",
    question: "Where can I see my payment history?",
    answer:
      "In your vault under Payments and billing. Every amount, its reference, method, and status is listed there, and premium payments awaiting action are highlighted.",
  },
  {
    category: "Claims",
    question: "How long does a claim take?",
    answer:
      "It depends on the claim, the evidence, and how quickly third parties respond. We do not publish a settlement promise, because a decision requires a person to review the documents. You can follow the status and any information requests on the claim itself.",
  },
  {
    category: "Claims",
    question: "What information should I have ready?",
    answer:
      "The policy and product, the date and location of the incident, a clear description of what happened, the amount you are claiming, and any supporting documents such as photographs, receipts, or reports.",
  },
  {
    category: "Claims",
    question: "Does submitting a claim mean it will be paid?",
    answer:
      "No. Submitting a claim starts a review. A handler assesses it against the policy terms, may ask for more information, and then records a decision with the reasons.",
  },
  {
    category: "Claims",
    question: "What if my claim is declined?",
    answer:
      "You will be told the reason. You can respond with further information, or raise a support request to have the position explained. The complaints procedure sets out the formal route if you remain unhappy.",
  },
  {
    category: "Claims",
    question: "Can I dispute an outcome?",
    answer:
      "Yes. A decided claim can be disputed with supporting information, which is recorded on the claim. If the dispute is not resolved to your satisfaction, the complaints procedure applies.",
  },
  {
    category: "Accounts and security",
    question: "How do I sign in?",
    answer:
      "With your email address and a one-time code sent to that inbox. There is no password to choose or remember, and no password for anyone to guess.",
  },
  {
    category: "Accounts and security",
    question: "What is a guest session?",
    answer:
      "A guest session lets you look around the product without creating an account. It is temporary: work done in a guest session is not permanently saved against an identity. Sign in with your email when you want quotations and applications to stay on your record.",
  },
  {
    category: "Accounts and security",
    question: "Who can see my records?",
    answer:
      "You, and only the people who need to act on them: authorised staff whose role includes the relevant permission, and an assigned broker acting for you. Access is enforced on the server for each record, not just hidden in the menu.",
  },
  {
    category: "Accounts and security",
    question: "How do I ask for a copy of my data?",
    answer:
      "Contact support and say what you need. Requests about your personal data are handled under the privacy notice, and anything requiring formal verification will be explained before it is actioned.",
  },
  {
    category: "Renewals and changes",
    question: "When will I hear about my renewal?",
    answer:
      "Before the renewal date, based on the renewal notice period configured for the product. The renewal appears in your vault so you can review the terms before it is due.",
  },
  {
    category: "Renewals and changes",
    question: "Can I change my policy mid-term?",
    answer:
      "You can request a change - an endorsement - from the policy in your vault. Requests are reviewed by a person, and the policy only changes once the request is approved and the change is recorded.",
  },
  {
    category: "Renewals and changes",
    question: "How do I cancel?",
    answer:
      "Submit a cancellation request against the policy. It is assessed against the policy conditions and the cancellation notice period, and you will be told the outcome and any effect on premium.",
  },
  {
    category: "Renewals and changes",
    question: "What if my circumstances change?",
    answer:
      "Tell us. A new address, a new driver, a change of business activity, or a new declared condition can all affect the cover. Keeping the record accurate is what keeps a claim straightforward later.",
  },
];

export function faqsForCategory(category: FaqCategory) {
  return FAQS.filter((faq) => faq.category === category);
}
