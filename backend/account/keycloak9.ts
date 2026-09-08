import type {
  Credential,
  CredentialType,
  Profile,
  ProfileInput,
} from "#shared/types";

import { request } from "./shared.ts";

interface LegacyCredentialType extends CredentialType {
  userCredentials: Credential[];
}

export const readProfile = (accessToken: string) =>
  request<Profile>(accessToken, "");

export async function updateProfile(accessToken: string, input: ProfileInput) {
  // Omitting attributes preserves the legacy account's custom attributes.
  await request(accessToken, "", "POST", {
    firstName: input.name,
    lastName: null,
    email: input.email,
  });
}

export async function security(accessToken: string) {
  const types = await request<LegacyCredentialType[]>(
    accessToken,
    "credentials",
  );

  return {
    passwordForm: true,
    credentials: types.map(({ userCredentials, ...type }) => ({
      ...type,
      credentials: userCredentials,
    })),
  };
}

export async function updatePassword(
  accessToken: string,
  input: {
    currentPassword: string;
    newPassword: string;
    confirmation: string;
  },
) {
  await request(accessToken, "credentials/password", "POST", input);
}

export async function removeCredential(accessToken: string, id: string) {
  await request(accessToken, `credentials/${encodeURIComponent(id)}`, "DELETE");

  return null;
}
