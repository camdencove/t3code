import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

import {
  ForwardCompatibleUnion,
  isUnknownUnionMember,
  TrimmedNonEmptyString,
  type UnknownUnionMember,
} from "./baseSchemas.ts";

export const ProjectIconColor = Schema.Literals([
  "gray",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
]);
export type ProjectIconColor = typeof ProjectIconColor.Type;

const ProjectLucideIconName = TrimmedNonEmptyString.check(
  Schema.isMaxLength(64),
  Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
);

const ProjectEmoji = TrimmedNonEmptyString.check(Schema.isMaxLength(32));

// Grapheme-count validation belongs to the server command boundary, not snapshot decoding.
export const ProjectMonogramText = TrimmedNonEmptyString.check(
  Schema.isMaxLength(32),
  Schema.isPattern(/^[\p{L}\p{N}][\p{L}\p{N}\p{M}\u200c\u200d]*$/u),
);

const ProjectLucideIcon = Schema.Struct({
  kind: Schema.Literal("lucide"),
  name: ProjectLucideIconName,
  color: ProjectIconColor,
});
const ProjectEmojiIcon = Schema.Struct({
  kind: Schema.Literal("emoji"),
  emoji: ProjectEmoji,
});
const ProjectMonogramIcon = Schema.Struct({
  kind: Schema.Literal("monogram"),
  text: ProjectMonogramText,
  color: ProjectIconColor,
});
export const ProjectFaviconPath = TrimmedNonEmptyString.check(
  Schema.isMaxLength(1024),
  Schema.isPattern(/\.(?:avif|gif|icns|ico|jpe?g|png|svg|webp)$/i),
);
export type ProjectFaviconPath = typeof ProjectFaviconPath.Type;

export const ProjectIconOverride = Schema.Union([
  ProjectLucideIcon,
  ProjectEmojiIcon,
  ProjectMonogramIcon,
]);
export type ProjectIconOverride = typeof ProjectIconOverride.Type;

const ProjectLucideIconWithLegacyMonogram = Schema.Struct({
  ...ProjectLucideIcon.fields,
  monogramText: Schema.optional(ProjectMonogramText),
  monogram: Schema.optional(ProjectMonogramText),
});
const projectIconMembers = [
  ProjectLucideIconWithLegacyMonogram,
  ProjectEmojiIcon,
  ProjectMonogramIcon,
] as const;
type ProjectIconMember = (typeof projectIconMembers)[number]["Type"];

const fromLegacyMonogram = (icon: ProjectIconMember): ProjectIconOverride => {
  if (icon.kind !== "lucide") return icon;
  const text = icon.monogramText ?? icon.monogram;
  return text === undefined
    ? { kind: "lucide", name: icon.name, color: icon.color }
    : { kind: "monogram", text, color: icon.color };
};

export const StoredProjectIcon = Schema.Union(projectIconMembers).pipe(
  Schema.decodeTo(
    Schema.toType(ProjectIconOverride),
    SchemaTransformation.transform<ProjectIconOverride, ProjectIconMember>({
      decode: fromLegacyMonogram,
      encode: (icon) => icon,
    }),
  ),
);

export const ReceivedProjectIcon = ForwardCompatibleUnion(projectIconMembers, "kind").pipe(
  Schema.decodeTo(
    Schema.NullOr(Schema.toType(ProjectIconOverride)),
    SchemaTransformation.transform<
      ProjectIconOverride | null,
      ProjectIconMember | UnknownUnionMember<"kind">
    >({
      decode: (icon) => (isUnknownUnionMember(icon) ? null : fromLegacyMonogram(icon)),
      encode: (icon) => icon as ProjectIconMember,
    }),
  ),
);
