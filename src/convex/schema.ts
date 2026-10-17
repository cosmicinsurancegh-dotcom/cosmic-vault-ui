import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

export const coverageValidator = v.union(
  v.literal("health"),
  v.literal("home"),
  v.literal("auto"),
  v.literal("life"),
);
export type CoverageType = Infer<typeof coverageValidator>;

export const quoteStatusValidator = v.union(
  v.literal("in_review"),
  v.literal("quoted"),
  v.literal("active"),
);
export type QuoteStatus = Infer<typeof quoteStatusValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // Quote requests created from the landing page or the member vault.
    quotes: defineTable({
      userId: v.optional(v.id("users")),
      reference: v.string(),
      name: v.string(),
      email: v.string(),
      coverage: coverageValidator,
      plan: v.optional(v.string()),
      message: v.optional(v.string()),
      status: quoteStatusValidator,
      monthlyEstimate: v.optional(v.number()),
    })
      .index("by_user", ["userId"])
      .index("by_email", ["email"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
