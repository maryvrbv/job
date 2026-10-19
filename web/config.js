// Public settings from Supabase → Project Settings → API.
// The publishable (anon) key is meant to be public: row level security keeps the data private.
window.JOB_CONFIG = {
  supabaseUrl: "https://iiaqpkynritnvcwjhooh.supabase.co",
  supabaseAnonKey: "sb_publishable_g-RDmNvLitjDhoKF3CSTHQ_7Ke_sQVH",
  // true: the «Написать письмо» button calls the Supabase function (needs an Anthropic API key).
  // false: the app copies a ready prompt for your Claude chat, no API costs.
  letterFunction: false,
  // Web Push public key (the private half lives only in Supabase, table app_secrets)
  vapidPublicKey: "BEtvtpen4EcdiWVCOIcupBVit1vBBZYY8X5VHrRlxZR3fyDupPzL9Dww70wASa0K8CtyoIYNaYeiYSXI9DAbY5A",
};
