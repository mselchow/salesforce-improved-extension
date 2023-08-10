import OptionsForm from "@/options/OptionsForm";

export default function Options() {
  return (
    <div className="flex flex-col container py-[2rem] max-w-md">
      <h1 className="text-2xl font-bold mb-4">Salesforce Improved - Options</h1>
      <OptionsForm />
    </div>
  );
}
