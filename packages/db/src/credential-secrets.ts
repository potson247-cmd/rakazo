import type { PrismaClient } from "./client.js";
import { Prisma } from "./client.js";
import { withTransactionRetry } from "./transaction-retry.js";

type CredentialSecretClient = Pick<
  PrismaClient,
  "secret" | "userModelCredential" | "userVoiceCredential"
>;

export async function deleteUnreferencedCredentialSecret(
  prisma: CredentialSecretClient,
  input: {
    credentialKind: "model" | "voice";
    credentialId: string;
    secretId: string;
  },
): Promise<void> {
  const [modelReferences, voiceReferences] = await Promise.all([
    prisma.userModelCredential.count({
      where: {
        secretId: input.secretId,
        ...(input.credentialKind === "model" ? { id: { not: input.credentialId } } : {}),
      },
    }),
    prisma.userVoiceCredential.count({
      where: {
        secretId: input.secretId,
        ...(input.credentialKind === "voice" ? { id: { not: input.credentialId } } : {}),
      },
    }),
  ]);
  if (modelReferences + voiceReferences === 0) {
    await prisma.secret.deleteMany({ where: { id: input.secretId } });
  }
}

/**
 * Confirm that a model credential's stored OAuth material is the material that
 * just failed a terminal refresh. The credential, its secret and every Space's
 * model choice are KEPT: the owner fixes it by signing in again, which renews
 * this connection in place. Returns true when the failure is confirmed (the run
 * fails without retrying), false when newer material won a race.
 *
 * Two guards keep a stale failure from being reported against newer material:
 * - `secretId`: a reconnect swaps the credential to a fresh secret row, so a
 *   mismatch means the retired material is already gone.
 * - `matchesFailedSecret`: a concurrent successful refresh rewrites the same
 *   secret row in place. The serializable check rereads its pointer and
 *   ciphertext and reports false on mismatch.
 */
export async function retireModelCredential(
  prisma: Pick<PrismaClient, "$transaction">,
  input: {
    userId: string;
    credentialId: string;
    secretId?: string;
    matchesFailedSecret?: (secret: {
      id: string;
      ciphertext: string;
    }) => boolean | Promise<boolean>;
  },
): Promise<boolean> {
  if (!input.credentialId) return false;
  return withTransactionRetry(async () => {
    const checked = input.matchesFailedSecret
      ? await prisma.$transaction(async (tx) => {
          const credential = await tx.userModelCredential.findFirst({
            where: { id: input.credentialId, userId: input.userId },
          });
          if (!credential || (input.secretId && credential.secretId !== input.secretId))
            return undefined;
          return {
            credential,
            secret: await tx.secret.findFirst({
              where: { id: credential.secretId },
              select: { id: true, ciphertext: true },
            }),
          };
        })
      : undefined;
    if (
      input.matchesFailedSecret &&
      (!checked || (checked.secret && !(await input.matchesFailedSecret(checked.secret))))
    )
      return false;
    return prisma.$transaction(
      async (tx) => {
        const credential = await tx.userModelCredential.findFirst({
          where: { id: input.credentialId, userId: input.userId },
        });
        if (!credential || (input.secretId && credential.secretId !== input.secretId)) return false;
        if (input.matchesFailedSecret) {
          const secret = await tx.secret.findFirst({
            where: { id: credential.secretId },
            select: { id: true, ciphertext: true },
          });
          if (
            credential.secretId !== checked?.credential.secretId ||
            secret?.ciphertext !== checked?.secret?.ciphertext
          )
            return false;
        }
        // Keep the connection, its secret and every Space's model choice. A
        // refresh the provider rejected (revoked grant, expired session,
        // account mismatch) is fixed by signing in again, which renews this
        // same connection in place. Deleting it here silently disconnected
        // every bot on the provider and threw away the owner's model setup.
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  });
}
