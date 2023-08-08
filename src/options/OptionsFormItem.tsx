import { FormItem, FormLabel, FormControl } from "@/components/ui/form";

interface OptionsFormItemProps {
  label: string;
  children?: React.ReactNode;
}

export default function OptionsFormItem({
  label,
  children,
}: OptionsFormItemProps) {
  return (
    <FormItem className="flex flex-row items-center justify-between space-y-0">
      <FormLabel className="text-base font-normal">{label}</FormLabel>
      <FormControl>{children}</FormControl>
    </FormItem>
  );
}
