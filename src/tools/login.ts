export async function loginSetup(): Promise<string> {
  return [
    "No login required.",
    "",
    "This tool searches LinkedIn, SimplyHired, Dice, and Remotive — all of which work without an account.",
    "Just run search_jobs or search_and_export to start searching.",
  ].join("\n");
}
