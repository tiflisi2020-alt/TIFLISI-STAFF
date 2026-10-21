import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  currentSubscription,
  pushSupport,
  subscribePhone,
  unsubscribePhone,
  type PushSupport,
} from "@/lib/phonePush";

export default function PhoneNotifications({ userId }: { userId: number }) {
  const config = trpc.staff.pushConfig.useQuery(undefined, { retry: false });
  const save = trpc.staff.savePushSubscription.useMutation();
  const remove = trpc.staff.removePushSubscription.useMutation();
  const [support, setSupport] = useState<PushSupport>("default");
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const syncedFor = useRef<number | null>(null);
  const saveSubscription = useRef(save.mutateAsync);
  saveSubscription.current = save.mutateAsync;

  useEffect(() => {
    const next = pushSupport();
    setSupport(next);
    if (next !== "granted") return;
    void currentSubscription().then(existing => setActive(Boolean(existing)));
  }, [userId]);

  useEffect(() => {
    if (support !== "granted" || !config.data?.enabled || !config.data.publicKey)
      return;
    if (syncedFor.current === userId) return;
    syncedFor.current = userId;
    const publicKey = config.data.publicKey;
    void (async () => {
      try {
        const subscription = await subscribePhone(publicKey);
        await saveSubscription.current(subscription);
        setActive(true);
      } catch {
        if (syncedFor.current === userId) syncedFor.current = null;
      }
    })();
  }, [config.data?.enabled, config.data?.publicKey, support, userId]);

  async function enable() {
    if (!config.data?.enabled || !config.data.publicKey) {
      toast.error("ტელეფონის შეტყობინება ჯერ არ არის მომზადებული.");
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      setSupport(permission);
      if (permission !== "granted") {
        toast.error("შეტყობინების ნებართვა არ მიეცა.");
        return;
      }
      const subscription = await subscribePhone(config.data.publicKey);
      await save.mutateAsync(subscription);
      setActive(true);
      toast.success("ტელეფონის შეტყობინება ჩართულია.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "შეტყობინება ვერ ჩაირთო."
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const endpoint = await unsubscribePhone();
      if (endpoint) await remove.mutateAsync({ endpoint });
      setActive(false);
      syncedFor.current = userId;
      toast.success("ტელეფონის შეტყობინება გამორთულია.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "გამორთვა ვერ შესრულდა."
      );
    } finally {
      setBusy(false);
    }
  }

  if (support === "unsupported") return null;
  return (
    <div className="phone-push">
      {support === "ios-install" ? (
        <p>
          iPhone-ზე ჯერ Safari-დან დაამატე საიტი მთავარ ეკრანზე, გახსენი იქიდან
          და შემდეგ ჩართე შეტყობინება.
        </p>
      ) : support === "denied" ? (
        <p>
          ბრაუზერმა შეტყობინება დაბლოკა. ჩართე ამ საიტის შეტყობინება ტელეფონის
          პარამეტრებიდან.
        </p>
      ) : active ? (
        <>
          <p>
            ტელეფონის შეტყობინება ჩართულია. მოთხოვნა და განცხადება მაშინაც მოვა,
            როცა საიტი დახურულია.
          </p>
          <button type="button" className="quiet" disabled={busy} onClick={disable}>
            გამორთვა
          </button>
        </>
      ) : (
        <>
          <p>ჩართე, რომ მოთხოვნა და განცხადება ტელეფონზე გამოჩნდეს.</p>
          <button type="button" disabled={busy || !userId} onClick={enable}>
            შეტყობინების ჩართვა
          </button>
        </>
      )}
    </div>
  );
}
