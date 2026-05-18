import { appConfig } from "../../shared/config";

type Props = {
  benchId: string;
};

export function SettingsExtras({ benchId }: Props) {
  const shareUrl = `${appConfig.pagesUrl}#${encodeURIComponent(benchId)}`;

  return (
    <>
      <p className="settings-help">
        Encode this URL in a QR sticker and put it on a physical bench:
      </p>
      <code className="settings-code">{shareUrl}</code>
    </>
  );
}
