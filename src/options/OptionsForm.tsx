import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import getExtensionStorage from "@/lib/getExtensionStorage";
import OptionsFormItem from "@/options/OptionsFormItem";

export type ExtensionOptions = typeof formSchema._output;

const formSchema = z.object({
  general: z.object({
    isPopupsMinimized: z.boolean().default(true),
  }),
  loginPage: z.object({
    isRecentLoginsOnRight: z.boolean().default(true),
    isRecentLoginsAlphabetized: z.boolean().default(true),
    isRecentLoginsCleanedUp: z.boolean().default(true),
  }),
  lightningPages: z.object({
    isWalkthroughTipsHidden: z.boolean().default(true),
    isAppExchangeLinkHidden: z.boolean().default(true),
    isPopupsHidden: z.boolean().default(true),
  }),
  flow: z.object({
    isModalWidthIncreased: z.boolean().default(true),
    isDebugDropdownOverflow: z.boolean().default(true),
    isSidebarWidthIncreased: z.boolean().default(true),
    isFormulaHeightIncreased: z.boolean().default(true),
    isFormulaFontMonospace: z.boolean().default(true),
  }),
  setup: z.object({
    isManagedPackagesSorted: z.boolean().default(true),
  }),
});

export default function OptionsForm() {
  const { toast } = useToast();
  const extOptions = getExtensionStorage();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: extOptions,
  });

  useEffect(() => {
    form.reset(extOptions);
  }, []);

  function onSubmit(data: z.infer<typeof formSchema>) {
    console.log(JSON.stringify(data));
    chrome.storage.sync.set(data, () => {
      if (chrome.runtime.lastError) {
        toast({
          title: "Error!",
          description: "There was an error saving your options.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Options saved!",
          description: "Your options have been saved.",
        });
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <h3 className="text-lg font-medium mb-2">General</h3>
          <div className="rounded-lg border p-3 space-y-2">
            <FormField
              control={form.control}
              name="general.isPopupsMinimized"
              render={({ field }) => (
                <OptionsFormItem label="Default Lightning pop-ups to be minimized">
                  <Switch
                    className="my-0"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </OptionsFormItem>
              )}
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Login Page</h3>
          <div className="rounded-lg border p-3 space-y-2">
            <FormField
              control={form.control}
              name="loginPage.isRecentLoginsOnRight"
              render={({ field }) => (
                <OptionsFormItem label="Recent logins on right">
                  <Switch
                    className="my-0"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </OptionsFormItem>
              )}
            />
            <FormField
              control={form.control}
              name="loginPage.isRecentLoginsAlphabetized"
              render={({ field }) => (
                <OptionsFormItem label="Recent logins alphabetized">
                  <Switch
                    className="my-0"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </OptionsFormItem>
              )}
            />
            <FormField
              control={form.control}
              name="loginPage.isRecentLoginsCleanedUp"
              render={({ field }) => (
                <OptionsFormItem label="Recent logins cleaned up">
                  <Switch
                    className="my-0"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </OptionsFormItem>
              )}
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Lightning Pages</h3>
          <div className="rounded-lg border p-3 space-y-2">
            <FormField
              control={form.control}
              name="lightningPages.isWalkthroughTipsHidden"
              render={({ field }) => (
                <OptionsFormItem label="Walkthrough tips hidden">
                  <Switch
                    className="my-0"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </OptionsFormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lightningPages.isAppExchangeLinkHidden"
              render={({ field }) => (
                <OptionsFormItem label="AppExchange link hidden">
                  <Switch
                    className="my-0"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </OptionsFormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lightningPages.isPopupsHidden"
              render={({ field }) => (
                <OptionsFormItem label="Additional pop-ups hidden">
                  <Switch
                    className="my-0"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </OptionsFormItem>
              )}
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Flow</h3>
          <div className="rounded-lg border p-3 space-y-2">
            <FormField
              control={form.control}
              name="flow.isModalWidthIncreased"
              render={({ field }) => (
                <OptionsFormItem label="Modal width increased">
                  <Switch
                    className="my-0"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </OptionsFormItem>
              )}
            />
            <FormField
              control={form.control}
              name="flow.isDebugDropdownOverflow"
              render={({ field }) => (
                <OptionsFormItem label="Debug record dropdown overflow container">
                  <Switch
                    className="my-0"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </OptionsFormItem>
              )}
            />
            <FormField
              control={form.control}
              name="flow.isSidebarWidthIncreased"
              render={({ field }) => (
                <OptionsFormItem label="Sidebar width increased">
                  <Switch
                    className="my-0"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </OptionsFormItem>
              )}
            />
            <FormField
              control={form.control}
              name="flow.isFormulaHeightIncreased"
              render={({ field }) => (
                <OptionsFormItem label="Formula textbox height increased">
                  <Switch
                    className="my-0"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </OptionsFormItem>
              )}
            />
            <FormField
              control={form.control}
              name="flow.isFormulaFontMonospace"
              render={({ field }) => (
                <OptionsFormItem label="Formula font formatting">
                  <Switch
                    className="my-0"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </OptionsFormItem>
              )}
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Setup</h3>
          <div className="rounded-lg border p-3 space-y-2">
            <FormField
              control={form.control}
              name="setup.isManagedPackagesSorted"
              render={({ field }) => (
                <OptionsFormItem label="Allow managed packages to be sorted">
                  <Switch
                    className="my-0"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </OptionsFormItem>
              )}
            />
          </div>
        </div>

        <Button type="submit">Save Settings</Button>
      </form>
    </Form>
  );
}
