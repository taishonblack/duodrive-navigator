import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsWithSecurityHeaders } from "../_shared/security-headers.ts";

const corsHeaders = getCorsWithSecurityHeaders();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error('Missing Twilio credentials');
      throw new Error('Twilio credentials not configured');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials');
      throw new Error('Supabase credentials not configured');
    }

    const { sessionId, coachPhoneNumber, customerPhoneNumber } = await req.json();

    if (!sessionId || !coachPhoneNumber || !customerPhoneNumber) {
      console.error('Missing required fields:', { sessionId, coachPhoneNumber: !!coachPhoneNumber, customerPhoneNumber: !!customerPhoneNumber });
      throw new Error('Missing required fields: sessionId, coachPhoneNumber, customerPhoneNumber');
    }

    console.log('Creating masked phone session for:', sessionId);

    // Create Twilio API URL for proxy service
    const twilioApiUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers.json`;
    
    // For phone masking, we'll use Twilio's Proxy service
    // First, let's create a TwiML application that forwards calls
    const proxyServiceUrl = `https://proxy.twilio.com/v1/Services`;
    
    // Check if we have a proxy service, if not create one
    const listServicesResponse = await fetch(proxyServiceUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
      },
    });

    const servicesData = await listServicesResponse.json();
    console.log('Existing proxy services:', servicesData);

    let proxyServiceSid: string;

    if (servicesData.services && servicesData.services.length > 0) {
      // Use existing service
      proxyServiceSid = servicesData.services[0].sid;
      console.log('Using existing proxy service:', proxyServiceSid);
    } else {
      // Create new proxy service
      console.log('Creating new proxy service...');
      const createServiceResponse = await fetch(proxyServiceUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          UniqueName: 'DuoDriveCoaching',
          DefaultTtl: '3600', // 1 hour session by default
        }).toString(),
      });

      const newService = await createServiceResponse.json();
      console.log('Created proxy service:', newService);
      
      if (newService.sid) {
        proxyServiceSid = newService.sid;
        
        // Add phone number to the service's phone number pool
        const addPhoneUrl = `https://proxy.twilio.com/v1/Services/${proxyServiceSid}/PhoneNumbers`;
        const addPhoneResponse = await fetch(addPhoneUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            PhoneNumber: twilioPhoneNumber,
          }).toString(),
        });
        
        const addedPhone = await addPhoneResponse.json();
        console.log('Added phone to proxy service:', addedPhone);
      } else {
        throw new Error('Failed to create proxy service');
      }
    }

    // Create a new session in the proxy service
    const createSessionUrl = `https://proxy.twilio.com/v1/Services/${proxyServiceSid}/Sessions`;
    const createSessionResponse = await fetch(createSessionUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        UniqueName: `coaching-${sessionId}`,
        Ttl: '3600', // 1 hour
        Mode: 'voice-only',
      }).toString(),
    });

    const proxySession = await createSessionResponse.json();
    console.log('Created proxy session:', proxySession);

    if (!proxySession.sid) {
      // If session already exists, try to fetch it
      if (proxySession.code === 80602) {
        console.log('Session already exists, fetching...');
        const existingSessionUrl = `https://proxy.twilio.com/v1/Services/${proxyServiceSid}/Sessions/coaching-${sessionId}`;
        const existingSessionResponse = await fetch(existingSessionUrl, {
          method: 'GET',
          headers: {
            'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
          },
        });
        const existingSession = await existingSessionResponse.json();
        console.log('Existing session:', existingSession);
        
        // Return the masked number
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: sessionData } = await supabase
          .from('coaching_sessions')
          .select('masked_phone_number')
          .eq('id', sessionId)
          .maybeSingle();
        
        return new Response(JSON.stringify({ 
          success: true, 
          maskedPhoneNumber: sessionData?.masked_phone_number || twilioPhoneNumber,
          message: 'Using existing session'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error('Failed to create proxy session: ' + JSON.stringify(proxySession));
    }

    const proxySessionSid = proxySession.sid;

    // Add participants to the session
    const participantsUrl = `https://proxy.twilio.com/v1/Services/${proxyServiceSid}/Sessions/${proxySessionSid}/Participants`;
    
    // Add coach as participant
    const addCoachResponse = await fetch(participantsUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        Identifier: coachPhoneNumber,
        FriendlyName: 'Coach',
      }).toString(),
    });

    const coachParticipant = await addCoachResponse.json();
    console.log('Added coach participant:', coachParticipant);

    // Add customer as participant
    const addCustomerResponse = await fetch(participantsUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        Identifier: customerPhoneNumber,
        FriendlyName: 'Customer',
      }).toString(),
    });

    const customerParticipant = await addCustomerResponse.json();
    console.log('Added customer participant:', customerParticipant);

    // The proxy number is the number both parties will see
    const maskedPhoneNumber = coachParticipant.proxy_identifier || twilioPhoneNumber;

    // Update the coaching session with the masked phone number and Twilio room SID
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { error: updateError } = await supabase
      .from('coaching_sessions')
      .update({ 
        masked_phone_number: maskedPhoneNumber,
        twilio_room_sid: proxySessionSid 
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Failed to update coaching session:', updateError);
      throw new Error('Failed to update coaching session');
    }

    console.log('Successfully created masked phone session');

    return new Response(JSON.stringify({ 
      success: true, 
      maskedPhoneNumber,
      proxySessionSid,
      message: 'Masked phone session created successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error creating masked phone session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create masked phone session';
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
