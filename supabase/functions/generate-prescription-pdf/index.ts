import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { prescription_id } = await req.json();

    // Buscar receituário
    const { data: prescription, error: prescError } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('id', prescription_id)
      .single();

    if (prescError || !prescription) {
      throw new Error('Receituário não encontrado');
    }

    // Buscar perfil do médico
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', prescription.user_id)
      .single();

    if (profileError) {
      console.error('Erro ao buscar perfil:', profileError);
    }

    // Gerar HTML do receituário
    const html = generatePrescriptionHTML(prescription, profile);

    // Aqui você integraria com um serviço de geração de PDF
    // Por enquanto, vamos retornar uma mensagem de sucesso
    // Em produção, use um serviço como Puppeteer, PDFKit ou similar

    console.log('PDF gerado para receituário:', prescription_id);

    return new Response(
      JSON.stringify({
        success: true,
        pdf_url: 'https://example.com/prescription.pdf', // URL temporária
        html: html
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function generatePrescriptionHTML(prescription: any, profile: any): string {
  const items = prescription.items || [];
  const patientAge = prescription.patient_dob 
    ? new Date().getFullYear() - new Date(prescription.patient_dob).getFullYear()
    : null;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header img {
      max-width: 150px;
      max-height: 80px;
      margin-bottom: 10px;
    }
    .header h1 {
      font-size: 18pt;
      margin: 10px 0 5px;
    }
    .header p {
      font-size: 10pt;
      margin: 2px 0;
    }
    .doctor-info {
      font-size: 11pt;
      margin-bottom: 15px;
    }
    .patient-info {
      background: #f5f5f5;
      padding: 15px;
      margin: 20px 0;
      border-left: 4px solid #007bff;
    }
    .patient-info h2 {
      font-size: 14pt;
      margin-bottom: 10px;
      color: #007bff;
    }
    .prescription-symbol {
      font-size: 48pt;
      font-weight: bold;
      color: #007bff;
      margin: 20px 0 10px;
    }
    .medications {
      margin: 30px 0;
    }
    .medication-item {
      margin-bottom: 25px;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 5px;
    }
    .medication-item h3 {
      font-size: 14pt;
      color: #000;
      margin-bottom: 8px;
    }
    .medication-item p {
      margin: 5px 0;
      padding-left: 10px;
    }
    .footer-text {
      margin-top: 30px;
      padding: 15px;
      background: #fff8dc;
      border: 1px solid #ffd700;
      border-radius: 5px;
      font-size: 10pt;
      font-style: italic;
    }
    .signature-section {
      margin-top: 60px;
      text-align: center;
    }
    .signature-section img {
      max-width: 200px;
      max-height: 80px;
      margin: 10px 0;
    }
    .signature-line {
      width: 300px;
      border-top: 1px solid #000;
      margin: 40px auto 10px;
    }
    .stamp {
      text-align: center;
      margin-top: 20px;
    }
    .stamp img {
      max-width: 150px;
      max-height: 150px;
    }
    .date {
      text-align: right;
      margin-top: 20px;
      font-size: 11pt;
    }
  </style>
</head>
<body>
  <div class="header">
    ${profile?.logo_url ? `<img src="${profile.logo_url}" alt="Logo">` : ''}
    <h1>${profile?.full_name || 'Médico'}</h1>
    <div class="doctor-info">
      ${profile?.crm && profile?.crm_uf ? `<p>CRM: ${profile.crm}/${profile.crm_uf}</p>` : ''}
      ${profile?.specialty ? `<p>Especialidade: ${profile.specialty}</p>` : ''}
      ${profile?.clinic_name ? `<p>${profile.clinic_name}</p>` : ''}
      ${profile?.address ? `<p>${profile.address}</p>` : ''}
      ${profile?.phone ? `<p>Tel: ${profile.phone}</p>` : ''}
      ${profile?.email_public ? `<p>Email: ${profile.email_public}</p>` : ''}
    </div>
  </div>

  <div class="patient-info">
    <h2>Dados do Paciente</h2>
    <p><strong>Nome:</strong> ${prescription.patient_name}</p>
    ${patientAge ? `<p><strong>Idade:</strong> ${patientAge} anos</p>` : ''}
    ${prescription.patient_sex ? `<p><strong>Sexo:</strong> ${prescription.patient_sex}</p>` : ''}
    ${prescription.patient_id_external ? `<p><strong>Prontuário:</strong> ${prescription.patient_id_external}</p>` : ''}
  </div>

  <div class="date">
    ${new Date(prescription.created_at).toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    })}
  </div>

  <div class="prescription-symbol">℞</div>

  <div class="medications">
    ${items.map((item: any, index: number) => `
      <div class="medication-item">
        <h3>${index + 1}. ${item.medicamento}</h3>
        <p><strong>Dosagem:</strong> ${item.dosagem}</p>
        <p><strong>Posologia:</strong> ${item.posologia}</p>
        ${item.duracao ? `<p><strong>Duração:</strong> ${item.duracao}</p>` : ''}
        ${item.observacoes ? `<p><strong>Observações:</strong> ${item.observacoes}</p>` : ''}
      </div>
    `).join('')}
  </div>

  ${prescription.notes ? `
    <div class="footer-text">
      <strong>Observações Gerais:</strong><br>
      ${prescription.notes}
    </div>
  ` : ''}

  ${profile?.prescription_footer_text ? `
    <div class="footer-text">
      ${profile.prescription_footer_text}
    </div>
  ` : ''}

  <div class="signature-section">
    ${profile?.signature_image_url ? `
      <img src="${profile.signature_image_url}" alt="Assinatura">
    ` : `
      <div class="signature-line"></div>
    `}
    <p><strong>${profile?.full_name || 'Médico'}</strong></p>
    ${profile?.crm && profile?.crm_uf ? `<p>CRM: ${profile.crm}/${profile.crm_uf}</p>` : ''}
  </div>

  ${profile?.stamp_image_url ? `
    <div class="stamp">
      <img src="${profile.stamp_image_url}" alt="Carimbo">
    </div>
  ` : ''}
</body>
</html>
  `.trim();
}
