# JengaTrack Launch Checklist

## Before Going Live

- [ ] OpenAI API key added to Vercel
- [ ] All env vars set in Vercel (see HANDOVER.md Section 5)
- [ ] jengatrack.com purchased on Namecheap (or domain of choice)
- [ ] Domain connected to Vercel
- [ ] DASHBOARD_URL updated to jengatrack.com
- [ ] Twilio webhook URL updated to `https://jengatrack.com/api/whatsapp-webhook`
- [ ] Test login works
- [ ] Test project creation works
- [ ] Test WhatsApp expense logging works
- [ ] Test receipt photo scanning works
- [ ] Test budget query works
- [ ] Test materials tracking works
- [ ] Test daily log works
- [ ] Test dashboard updates within 30s

## Handover Checklist

- [ ] GitHub repo transferred to buyer
- [ ] Vercel: buyer email added as owner
- [ ] Supabase: buyer email added as admin
- [ ] Twilio: credentials shared with buyer
- [ ] OpenAI: buyer's own key in use
- [ ] Namecheap: buyer's own account
- [ ] HANDOVER.md delivered
- [ ] Admin SQL queries delivered (scripts/admin-queries.sql)
- [ ] Video walkthrough recorded (optional)

## Monthly Maintenance

- [ ] Check Vercel error logs weekly
- [ ] Monitor Supabase database size
- [ ] Review OpenAI usage and costs
- [ ] Renew domain annually (~$10)
- [ ] Apply for WhatsApp Business API (removes Twilio sandbox limitations)
