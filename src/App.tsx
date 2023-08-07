import { Button } from "@/components/ui/button";
import icon from "/icons/icon-48.png";

export default function App() {
  return (
    <div className="flex flex-col border-foreground border-2 w-80">
      <div className="flex flex-col items-center gap-5 py-10">
        <img src={icon} className="w-50 h-50" />
        <span className="text-2xl font-bold text-center">
          Salesforce Improved
        </span>
        <Button
          className="mt-5"
          onClick={() => {
            if (chrome.runtime.openOptionsPage) {
              chrome.runtime.openOptionsPage();
            } else {
              window.open(chrome.runtime.getURL("options.html"));
            }
          }}
        >
          Settings
        </Button>
      </div>
      <div className="flex flex-col gap-1 items-center pb-2 text-xs text-muted-foreground">
        <a
          href="https://github.com/mselchow/salesforce-improved-extension"
          className="underline"
        >
          GitHub
        </a>
        <span className="">&copy; Michael Selchow</span>
      </div>
    </div>
  );
}
