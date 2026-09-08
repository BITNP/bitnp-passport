import { ApplicationError } from "#backend/errors";
import type {
  Credential,
  CredentialType,
  Profile,
  ProfileInput,
} from "#shared/types";

import { request } from "./shared.ts";

interface ModernCredentialType extends CredentialType {
  userCredentialMetadatas: { credential: Credential }[];
}

export const readProfile = (accessToken: string) =>
  request<Profile>(accessToken, "?userProfileMetadata=true");

export async function updateProfile(accessToken: string, input: ProfileInput) {
  const profile = await readProfile(accessToken);

  await request(accessToken, "", "POST", {
    username: profile.username,
    attributes: profile.attributes,
    firstName: input.name,
    lastName: null,
    email: input.email,
  });
}

export async function security(accessToken: string) {
  const types = await request<ModernCredentialType[]>(
    accessToken,
    "credentials",
  );

  return {
    passwordForm: false,
    credentials: types.map(({ userCredentialMetadatas, ...type }) => ({
      ...type,
      credentials: userCredentialMetadatas.map(({ credential }) => credential),
    })),
  };
}

export async function updatePassword() {
  throw new ApplicationError(405, "此接口不支持修改密码");
}

export const removeCredential = async (_accessToken: string, id: string) =>
  `delete_credential:${id}`;
