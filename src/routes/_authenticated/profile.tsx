import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, updateProfile } from "@/lib/casino.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Upload, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(updateProfile);
  const { data: profile, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchProfile(),
  });

  const [username, setUsername] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.username) setUsername(profile.username);
  }, [profile?.username]);

  if (isLoading || !profile) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const canChangeName = (() => {
    if (!profile.username_changed_at) return true;
    const last = new Date(profile.username_changed_at).getTime();
    return Date.now() - last >= 365 * 24 * 60 * 60 * 1000;
  })();

  const nextChangeDate = profile.username_changed_at
    ? new Date(new Date(profile.username_changed_at).getTime() + 365 * 24 * 60 * 60 * 1000)
    : null;

  async function handleAvatarUpload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${profile!.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      await saveProfile({ data: { avatar_url: pub.publicUrl } });
      await qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Foto atualizada!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar foto");
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveName() {
    setSaving(true);
    try {
      await saveProfile({ data: { username } });
      await qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Nome de usuário atualizado!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight">Meu Perfil</h1>
        <p className="text-muted-foreground mt-1">Gerencie sua foto e nome de usuário</p>
      </div>

      <Card className="p-6 space-y-8">
        <div className="flex items-center gap-6">
          <Avatar className="h-24 w-24 ring-2 ring-primary/40">
            <AvatarImage src={profile.avatar_url || undefined} alt={profile.username} />
            <AvatarFallback className="bg-secondary text-2xl">
              <User className="h-10 w-10" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Label htmlFor="avatar" className="cursor-pointer">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary hover:bg-secondary/80 transition">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <span className="text-sm font-medium">{uploading ? "Enviando..." : "Trocar foto"}</span>
              </div>
              <input
                id="avatar"
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleAvatarUpload(file);
                }}
              />
            </Label>
            <p className="text-xs text-muted-foreground mt-2">JPG, PNG ou WebP. Máx ~5MB.</p>
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="username">Nome de usuário</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={!canChangeName}
            minLength={3}
            maxLength={30}
          />
          {canChangeName ? (
            <p className="text-xs text-muted-foreground">
              Você pode trocar o nome 1 vez por ano. Escolha com cuidado.
            </p>
          ) : (
            <p className="text-xs text-warning">
              Próxima troca disponível em {nextChangeDate?.toLocaleDateString("pt-BR")}
            </p>
          )}
          <Button
            onClick={handleSaveName}
            disabled={!canChangeName || saving || username === profile.username || username.length < 3}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar nome
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-6 border-t border-border">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wider">Plano</p>
            <p className="font-bold capitalize mt-1">{profile.plan}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wider">Saldo</p>
            <p className="font-bold mt-1 text-[color:var(--gold)]">
              {Number(profile.coins).toLocaleString("pt-BR")} 🪙
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}