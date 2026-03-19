import { AppLayout } from "@/components/layout";
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from "@/hooks/use-api-keys";
import { KeyRound, Plus, Trash2, Copy, CheckCircle2, ShieldAlert, Bot } from "lucide-react";
import { useState } from "react";

export default function ApiKeys() {
  const { data: keys, isLoading } = useApiKeys();
  const createMutation = useCreateApiKey();
  const deleteMutation = useDeleteApiKey();
  
  const [newKeyName, setNewKeyName] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    
    createMutation.mutate({ name: newKeyName, key: "" }, {
      onSuccess: () => setNewKeyName("")
    });
  };

  const copyToClipboard = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-10 h-full overflow-y-auto w-full max-w-5xl mx-auto">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <KeyRound className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold tracking-tighter text-glow-primary">Developer API</h1>
          </div>
          <p className="text-muted-foreground font-mono text-sm max-w-xl">
            Manage your API keys for programmatic access. Use these keys to authenticate your Discord bots or external systems.
          </p>
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column: Form & Info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-card rounded-2xl p-6 border-primary/20">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Generate Key
              </h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-muted-foreground mb-2">
                    IDENTIFIER / BOT NAME
                  </label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. Discord Bot Prod"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-mono text-foreground"
                    maxLength={50}
                  />
                </div>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !newKeyName.trim()}
                  className="w-full py-3 bg-primary text-primary-foreground font-bold tracking-wide rounded-xl shadow-[0_0_15px_rgba(0,255,255,0.3)] hover:shadow-[0_0_25px_rgba(0,255,255,0.5)] transition-all disabled:opacity-50 disabled:shadow-none"
                >
                  {createMutation.isPending ? "GENERATING..." : "GENERATE SECURE KEY"}
                </button>
              </form>
            </div>

            <div className="glass-card rounded-2xl p-6 bg-accent/5 border-accent/20">
              <h3 className="font-bold flex items-center gap-2 mb-3 text-accent text-glow-accent">
                <Bot className="w-5 h-5" />
                Discord Bot Integration
              </h3>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                Connect your custom Discord bot to our real-time feed. Pass the API key in the Authorization header:
              </p>
              <div className="bg-black/50 p-4 rounded-lg font-mono text-xs text-primary/80 overflow-x-auto border border-white/5">
                <span className="text-muted-foreground">Authorization:</span> Bearer astral_YOUR_KEY_HERE
              </div>
            </div>
          </div>

          {/* Right Column: Keys List */}
          <div className="lg:col-span-2">
            <div className="glass-card rounded-2xl p-6 min-h-[400px]">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-primary" />
                Active Access Keys
              </h2>

              {isLoading ? (
                <div className="space-y-4">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-20 bg-white/5 border border-white/10 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : keys?.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
                  <KeyRound className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-mono text-sm">No API keys generated.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {keys?.map(keyItem => (
                    <div key={keyItem.id} className="bg-black/30 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-primary/30 transition-colors group">
                      <div>
                        <div className="font-bold text-foreground mb-1">{keyItem.name}</div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-white/5 px-2 py-1 rounded text-primary/80 font-mono">
                            {keyItem.key}
                          </code>
                          <button
                            onClick={() => copyToClipboard(keyItem.id, keyItem.key)}
                            className="text-muted-foreground hover:text-primary transition-colors p-1"
                            title="Copy to clipboard"
                          >
                            {copiedId === keyItem.id ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-mono text-muted-foreground">
                          {keyItem.createdAt && new Date(keyItem.createdAt).toLocaleDateString()}
                        </span>
                        <button
                          onClick={() => deleteMutation.mutate(keyItem.id)}
                          disabled={deleteMutation.isPending}
                          className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors border border-transparent hover:border-destructive/30"
                          title="Revoke Key"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
