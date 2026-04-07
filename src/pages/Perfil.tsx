import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, ArrowLeft, Upload, X, Save, CreditCard, Settings, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSpecialtyTemplates } from '@/hooks/useSpecialtyTemplates';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import {
  validateCRM,
  validateCRMUF,
  validateEmail,
  validatePhone,
  validateFile,
  sanitizeText
} from '@/lib/validation';

export default function Perfil() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { subscription, loading: subLoading } = useSubscription();
  const { templates: specialtyTemplates, loading: templatesLoading } = useSpecialtyTemplates();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    crm: '',
    crm_uf: '',
    specialty: '',
    clinic_name: '',
    address: '',
    phone: '',
    email_public: '',
    logo_url: '',
    signature_image_url: '',
    stamp_image_url: '',
    prescription_footer_text: 'Uso conforme orientação médica. Não se automedique.'
  });

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          full_name: data.full_name || '',
          email: data.email || '',
          crm: data.crm || '',
          crm_uf: data.crm_uf || '',
          specialty: data.specialty || '',
          clinic_name: data.clinic_name || '',
          address: data.address || '',
          phone: data.phone || '',
          email_public: data.email_public || '',
          logo_url: data.logo_url || '',
          signature_image_url: data.signature_image_url || '',
          stamp_image_url: data.stamp_image_url || '',
          prescription_footer_text: data.prescription_footer_text || 'Uso conforme orientação médica. Não se automedique.'
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar seus dados',
        variant: 'destructive'
      });
    }
  };

  const handleImageUpload = async (file: File, type: 'logo' | 'signature' | 'stamp') => {
    try {
      setUploading(type);

      // Validar arquivo
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
      const validation = validateFile(file, {
        maxSize: 5 * 1024 * 1024,
        allowedTypes: validTypes
      });

      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Upload para Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/${type}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('audio-files')
        .getPublicUrl(fileName);

      const fieldMap = {
        logo: 'logo_url',
        signature: 'signature_image_url',
        stamp: 'stamp_image_url'
      };

      setFormData(prev => ({
        ...prev,
        [fieldMap[type]]: urlData.publicUrl
      }));

      toast({
        title: 'Sucesso',
        description: `${type === 'logo' ? 'Logo' : type === 'signature' ? 'Assinatura' : 'Carimbo'} enviado com sucesso`
      });
    } catch (error: any) {
      toast({
        title: 'Erro no upload',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setUploading(null);
    }
  };

  const handleRemoveImage = (type: 'logo' | 'signature' | 'stamp') => {
    const fieldMap = {
      logo: 'logo_url',
      signature: 'signature_image_url',
      stamp: 'stamp_image_url'
    };

    setFormData(prev => ({
      ...prev,
      [fieldMap[type]]: ''
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      // Validações com mensagens claras
      if (formData.crm && !validateCRM(formData.crm)) {
        throw new Error('CRM inválido. Digite apenas números (4-8 dígitos)');
      }

      if (formData.crm_uf && !validateCRMUF(formData.crm_uf)) {
        throw new Error('UF inválida. Digite 2 letras maiúsculas (ex: SP, RJ)');
      }

      if (formData.email_public && !validateEmail(formData.email_public)) {
        throw new Error('Email público inválido');
      }

      if (formData.phone && !validatePhone(formData.phone)) {
        throw new Error('Telefone inválido');
      }

      // Sanitizar textos
      const sanitizedData = {
        full_name: sanitizeText(formData.full_name),
        crm: formData.crm.replace(/\D/g, ''),
        crm_uf: formData.crm_uf.toUpperCase(),
        specialty: sanitizeText(formData.specialty),
        clinic_name: sanitizeText(formData.clinic_name),
        address: sanitizeText(formData.address),
        phone: formData.phone,
        email_public: formData.email_public,
        logo_url: formData.logo_url,
        signature_image_url: formData.signature_image_url,
        stamp_image_url: formData.stamp_image_url,
        prescription_footer_text: sanitizeText(formData.prescription_footer_text)
      };

      const { error } = await supabase
        .from('profiles')
        .update(sanitizedData)
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Perfil atualizado com sucesso'
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="bg-background/80 backdrop-blur-lg border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Activity className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold">Meu Perfil Profissional</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="space-y-6">
          {/* Dados Pessoais */}
          <Card>
            <CardHeader>
              <CardTitle>Dados Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="full_name">Nome Completo *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Dr. João Silva"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email (não editável)</Label>
                  <Input
                    id="email"
                    value={formData.email}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="crm">CRM *</Label>
                  <Input
                    id="crm"
                    value={formData.crm}
                    onChange={(e) => setFormData(prev => ({ ...prev, crm: e.target.value.replace(/\D/g, '') }))}
                    placeholder="123456"
                    maxLength={8}
                  />
                </div>
                <div>
                  <Label htmlFor="crm_uf">UF do CRM *</Label>
                  <Input
                    id="crm_uf"
                    value={formData.crm_uf}
                    onChange={(e) => setFormData(prev => ({ ...prev, crm_uf: e.target.value.toUpperCase() }))}
                    placeholder="SP"
                    maxLength={2}
                  />
                </div>
                <div>
                  <Label htmlFor="specialty">Especialidade</Label>
                  {templatesLoading ? (
                    <Input disabled placeholder="Carregando..." />
                  ) : (
                    <Select
                      value={formData.specialty || 'clinica_geral'}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, specialty: value }))}
                    >
                      <SelectTrigger id="specialty">
                        <SelectValue placeholder="Selecione sua especialidade" />
                      </SelectTrigger>
                      <SelectContent>
                        {specialtyTemplates.map((t) => (
                          <SelectItem key={t.specialty} value={t.specialty}>
                            {t.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dados da Clínica */}
          <Card>
            <CardHeader>
              <CardTitle>Dados da Clínica/Consultório</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="clinic_name">Nome da Clínica</Label>
                <Input
                  id="clinic_name"
                  value={formData.clinic_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, clinic_name: e.target.value }))}
                  placeholder="Clínica Saúde Total"
                />
              </div>

              <div>
                <Label htmlFor="address">Endereço Completo</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Rua Example, 123 - Bairro - Cidade/UF - CEP 00000-000"
                  rows={2}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(11) 1234-5678"
                  />
                </div>
                <div>
                  <Label htmlFor="email_public">Email Público</Label>
                  <Input
                    id="email_public"
                    type="email"
                    value={formData.email_public}
                    onChange={(e) => setFormData(prev => ({ ...prev, email_public: e.target.value }))}
                    placeholder="contato@clinica.com.br"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Imagens */}
          <Card>
            <CardHeader>
              <CardTitle>Logo, Assinatura e Carimbo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo */}
              <div>
                <Label>Logo da Clínica (opcional)</Label>
                <p className="text-xs text-muted-foreground mb-2">PNG, JPG ou SVG - Máx 5MB</p>
                {formData.logo_url ? (
                  <div className="relative w-48 h-48 border rounded-lg p-4">
                    <img src={formData.logo_url} alt="Logo" className="w-full h-full object-contain" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => handleRemoveImage('logo')}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'logo')}
                      className="hidden"
                      id="logo-upload"
                    />
                    <label htmlFor="logo-upload">
                      <Button variant="outline" asChild disabled={uploading === 'logo'}>
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          {uploading === 'logo' ? 'Enviando...' : 'Enviar Logo'}
                        </span>
                      </Button>
                    </label>
                  </div>
                )}
              </div>

              {/* Assinatura */}
              <div>
                <Label>Assinatura Digital *</Label>
                <p className="text-xs text-muted-foreground mb-2">PNG ou JPG transparente - Máx 5MB</p>
                {formData.signature_image_url ? (
                  <div className="relative w-64 h-32 border rounded-lg p-4 bg-white">
                    <img src={formData.signature_image_url} alt="Assinatura" className="w-full h-full object-contain" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => handleRemoveImage('signature')}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'signature')}
                      className="hidden"
                      id="signature-upload"
                    />
                    <label htmlFor="signature-upload">
                      <Button variant="outline" asChild disabled={uploading === 'signature'}>
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          {uploading === 'signature' ? 'Enviando...' : 'Enviar Assinatura'}
                        </span>
                      </Button>
                    </label>
                  </div>
                )}
              </div>

              {/* Carimbo */}
              <div>
                <Label>Carimbo (opcional)</Label>
                <p className="text-xs text-muted-foreground mb-2">PNG ou JPG - Máx 5MB</p>
                {formData.stamp_image_url ? (
                  <div className="relative w-48 h-48 border rounded-lg p-4">
                    <img src={formData.stamp_image_url} alt="Carimbo" className="w-full h-full object-contain" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => handleRemoveImage('stamp')}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'stamp')}
                      className="hidden"
                      id="stamp-upload"
                    />
                    <label htmlFor="stamp-upload">
                      <Button variant="outline" asChild disabled={uploading === 'stamp'}>
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          {uploading === 'stamp' ? 'Enviando...' : 'Enviar Carimbo'}
                        </span>
                      </Button>
                    </label>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Rodapé de Receituário */}
          <Card>
            <CardHeader>
              <CardTitle>Texto Padrão para Receituários</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="footer">Texto do Rodapé</Label>
              <Textarea
                id="footer"
                value={formData.prescription_footer_text}
                onChange={(e) => setFormData(prev => ({ ...prev, prescription_footer_text: e.target.value }))}
                rows={3}
                placeholder="Uso conforme orientação médica..."
              />
            </CardContent>
          </Card>

          {/* Minha Assinatura */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Minha Assinatura
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {subLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : subscription ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Plano {subscription.plan}</p>
                      <p className="text-sm text-muted-foreground">
                        Status: {' '}
                        <Badge variant={subscription.isActive ? "default" : "destructive"}>
                          {subscription.status === 'ACTIVE' ? 'Ativo' : 
                           subscription.status === 'TRIALING' ? 'Período de teste' : 
                           subscription.status === 'CANCELED' ? 'Cancelado' : subscription.status}
                        </Badge>
                      </p>
                    </div>
                  </div>
                  {subscription.currentPeriodEnd && (
                    <p className="text-sm text-muted-foreground">
                      Próxima cobrança: {new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                  {subscription.isTrial && subscription.trialEnd && (
                    <p className="text-sm text-muted-foreground">
                      Teste grátis até: {new Date(subscription.trialEnd).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    onClick={async () => {
                      setPortalLoading(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('customer-portal');
                        if (error) throw error;
                        if (data?.url) window.open(data.url, '_blank');
                      } catch (err: any) {
                        sonnerToast.error(err.message || 'Erro ao abrir portal');
                      } finally {
                        setPortalLoading(false);
                      }
                    }}
                    disabled={portalLoading}
                    className="w-full"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    {portalLoading ? 'Abrindo...' : 'Gerenciar Assinatura'}
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Atualizar cartão, trocar plano ou cancelar assinatura
                  </p>
                </>
              ) : (
                <div className="text-center space-y-3">
                  <p className="text-sm text-muted-foreground">Nenhuma assinatura ativa</p>
                  <Button onClick={() => navigate('/medicos/teste-gratis')}>
                    Assinar Agora
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Botões */}
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading} className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Salvando...' : 'Salvar Perfil'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
