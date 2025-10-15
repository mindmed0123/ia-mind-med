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
      margin: 2.5cm;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', 'Arial', sans-serif;
      font-size: 11pt;
      line-height: 1.8;
      color: #1f2937;
    }
    .header {
      text-align: center;
      padding: 24px;
      margin-bottom: 32px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-radius: 12px;
      border-bottom: 3px solid #3b82f6;
    }
    .header img {
      max-width: 180px;
      max-height: 100px;
      margin-bottom: 16px;
      border-radius: 8px;
    }
    .header h1 {
      font-size: 20pt;
      margin: 12px 0 8px;
      color: #1e40af;
      font-weight: 700;
    }
    .header p {
      font-size: 10pt;
      margin: 4px 0;
      color: #475569;
    }
    .doctor-info {
      font-size: 10pt;
      margin-top: 12px;
      color: #64748b;
    }
    .patient-info {
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      padding: 20px;
      margin: 24px 0;
      border-left: 5px solid #10b981;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .patient-info h2 {
      font-size: 14pt;
      margin-bottom: 12px;
      color: #065f46;
      font-weight: 700;
    }
    .patient-info p {
      margin: 6px 0;
      color: #374151;
    }
    .patient-info strong {
      color: #047857;
      min-width: 100px;
      display: inline-block;
    }
    .prescription-symbol {
      font-size: 56pt;
      font-weight: bold;
      color: #3b82f6;
      margin: 24px 0 16px;
      text-align: center;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
    }
    .medications {
      margin: 32px 0;
    }
    .medication-item {
      margin-bottom: 24px;
      padding: 20px;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
      box-shadow: 0 2px 6px rgba(0,0,0,0.05);
      page-break-inside: avoid;
    }
    .medication-item h3 {
      font-size: 14pt;
      color: #1e40af;
      margin-bottom: 12px;
      font-weight: 700;
      padding-bottom: 8px;
      border-bottom: 2px solid #dbeafe;
    }
    .medication-item p {
      margin: 8px 0;
      padding-left: 12px;
      color: #374151;
    }
    .medication-item strong {
      color: #1e3a8a;
      min-width: 100px;
      display: inline-block;
      font-weight: 600;
    }
    .footer-text {
      margin-top: 32px;
      padding: 16px;
      background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%);
      border: 2px solid #fbbf24;
      border-radius: 8px;
      font-size: 10pt;
      font-style: italic;
      color: #92400e;
      box-shadow: 0 2px 6px rgba(0,0,0,0.05);
    }
    .footer-text strong {
      color: #78350f;
    }
    .signature-section {
      margin-top: 64px;
      text-align: center;
      page-break-inside: avoid;
    }
    .signature-section img {
      max-width: 220px;
      max-height: 90px;
      margin: 12px 0;
    }
    .signature-line {
      width: 350px;
      border-top: 2px solid #1e3a8a;
      margin: 48px auto 12px;
    }
    .signature-section p {
      margin: 4px 0;
      color: #1e40af;
      font-weight: 600;
    }
    .stamp {
      text-align: center;
      margin-top: 24px;
    }
    .stamp img {
      max-width: 170px;
      max-height: 170px;
      border-radius: 8px;
    }
    .date {
      text-align: right;
      margin-top: 24px;
      font-size: 11pt;
      color: #475569;
      font-weight: 500;
    }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 80pt;
      color: rgba(59, 130, 246, 0.03);
      font-weight: 900;
      z-index: -1;
      user-select: none;
    }
  </style>
</head>
<body>
  <div class="watermark">RECEITUÁRIO</div>
  
  <div class="header">
    ${profile?.logo_url ? `<img src="${profile.logo_url}" alt="Logo">` : ''}
    <h1>${profile?.full_name || 'Médico'}</h1>
    <div class="doctor-info">
      ${profile?.crm && profile?.crm_uf ? `<p style="font-weight:600;color:#1e40af;">CRM: ${profile.crm}/${profile.crm_uf}</p>` : ''}
      ${profile?.specialty ? `<p>${profile.specialty}</p>` : ''}
      ${profile?.clinic_name ? `<p style="margin-top:8px;font-weight:500;">${profile.clinic_name}</p>` : ''}
      ${profile?.address ? `<p>${profile.address}</p>` : ''}
      ${profile?.phone ? `<p>📞 ${profile.phone}</p>` : ''}
      ${profile?.email_public ? `<p>📧 ${profile.email_public}</p>` : ''}
    </div>
  </div>

  <div class="patient-info">
    <h2>👤 Dados do Paciente</h2>
    <p><strong>Nome:</strong> ${prescription.patient_name}</p>
    ${patientAge ? `<p><strong>Idade:</strong> ${patientAge} anos</p>` : ''}
    ${prescription.patient_sex ? `<p><strong>Sexo:</strong> ${prescription.patient_sex}</p>` : ''}
    ${prescription.patient_id_external ? `<p><strong>Prontuário:</strong> ${prescription.patient_id_external}</p>` : ''}
  </div>

  <div class="date">
    📅 ${new Date(prescription.created_at).toLocaleDateString('pt-BR', { 
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
        <p><strong>💊 Dosagem:</strong> ${item.dosagem}</p>
        <p><strong>⏰ Posologia:</strong> ${item.posologia}</p>
        ${item.duracao ? `<p><strong>📅 Duração:</strong> ${item.duracao}</p>` : ''}
        ${item.observacoes ? `<p><strong>📝 Observações:</strong> ${item.observacoes}</p>` : ''}
      </div>
    `).join('')}
  </div>

  ${prescription.notes ? `
    <div class="footer-text">
      <strong>⚠️ Observações Gerais:</strong><br>
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
    <p>${profile?.full_name || 'Médico'}</p>
    ${profile?.crm && profile?.crm_uf ? `<p style="font-size:10pt;color:#64748b;">CRM: ${profile.crm}/${profile.crm_uf}</p>` : ''}
  </div>

  ${profile?.stamp_image_url ? `
    <div class="stamp">
      <img src="${profile.stamp_image_url}" alt="Carimbo">
    </div>
  ` : ''}
  
  <div style="margin-top:32px;text-align:center;font-size:8pt;color:#94a3b8;padding:16px;border-top:1px solid #e2e8f0;">
    <p>📄 Receituário gerado por <strong style="color:#3b82f6;">MindMed</strong></p>
    <p style="margin-top:4px;">Este documento é válido apenas com assinatura e carimbo do médico responsável</p>
  </div>
</body>
</html>
  `.trim();
}
