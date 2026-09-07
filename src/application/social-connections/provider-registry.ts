/** Application-owned routing only. Adapters supply their capabilities at composition time. */
export class SocialProviderRegistry<Adapter> {
  private readonly adapters = new Map<string, Adapter>()

  constructor(entries: readonly (readonly [string, Adapter])[]) {
    for (const [provider, adapter] of entries) {
      if (!provider.trim() || provider !== provider.trim() || this.adapters.has(provider)) {
        throw new Error("Provider registry requires distinct nonblank provider names")
      }
      this.adapters.set(provider, adapter)
    }
  }

  resolve(provider: string): Adapter {
    if (!this.adapters.has(provider)) throw new Error("Social provider is not configured")
    return this.adapters.get(provider)!
  }
}
