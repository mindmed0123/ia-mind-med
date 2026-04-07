import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, MessageCircle, Phone, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const Contato = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica
    if (!formData.name || !formData.email || !formData.message) {
      toast.error("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    // Em produção, aqui faria a chamada para o backend
    toast.success("Mensagem enviada! Entraremos em contato em breve.");
    
    // Reset form
    setFormData({
      name: "",
      email: "",
      phone: "",
      message: "",
    });
  };

  const contactInfo = [
    {
      icon: Mail,
      label: "Email",
      value: "contato@mindmed.com.br",
      link: "mailto:contato@mindmed.com.br",
    },
    {
      icon: Phone,
      label: "Telefone",
      value: "(11) 9xxxx-xxxx",
      link: "tel:+5511xxxxxxxxx",
    },
    {
      icon: MessageCircle,
      label: "WhatsApp",
      value: "Fale conosco",
      link: "https://wa.me/55XXXXXXXXXXX",
    },
    {
      icon: MapPin,
      label: "Endereço",
      value: "São Paulo, SP - Brasil",
      link: null,
    },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 gradient-subtle">
        <div className="container mx-auto text-center max-w-4xl">
          <h1 className="mb-6">Entre em contato</h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Estamos aqui para ajudar. Envie sua mensagem ou escolha o canal que
            preferir para falar conosco
          </p>
        </div>
      </section>

      {/* Contato */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Formulário */}
            <Card className="shadow-large">
              <CardContent className="pt-6">
                <h2 className="text-2xl font-semibold mb-6">
                  Envie sua mensagem
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <Label htmlFor="name">
                      Nome completo <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Dr. João Silva"
                      required
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="joao@clinica.com.br"
                      required
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="(11) 9xxxx-xxxx"
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="message">
                      Mensagem <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      placeholder="Como podemos ajudar?"
                      required
                      rows={6}
                      className="mt-2"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full gradient-primary shadow-soft"
                  >
                    Enviar mensagem
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Info de contato */}
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-semibold mb-6">
                  Outras formas de contato
                </h2>
                <div className="space-y-4">
                  {contactInfo.map((info, index) => (
                    <Card key={index} className="shadow-soft">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <info.icon className="w-6 h-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold mb-1">{info.label}</p>
                            {info.link ? (
                              <a
                                href={info.link}
                                className="text-muted-foreground hover:text-primary transition-colors"
                              >
                                {info.value}
                              </a>
                            ) : (
                              <p className="text-muted-foreground">{info.value}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* WhatsApp CTA */}
              <Card className="shadow-large bg-gradient-to-br from-primary/10 to-accent/10 border-2 border-primary/20">
                <CardContent className="pt-6 text-center">
                  <MessageCircle className="w-16 h-16 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">
                    Prefere falar agora?
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Entre em contato direto pelo WhatsApp e tire suas dúvidas em
                    tempo real
                  </p>
                  <a
                    href="https://wa.me/55XXXXXXXXXXX"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button className="gradient-primary shadow-soft w-full">
                      <MessageCircle className="w-5 h-5 mr-2" />
                      Abrir WhatsApp
                    </Button>
                  </a>
                </CardContent>
              </Card>

              {/* Horário de atendimento */}
              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-4">Horário de atendimento</h3>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Segunda a Sexta: 9h às 18h</p>
                    <p>Sábado: 9h às 13h</p>
                    <p>Domingo e feriados: Fechado</p>
                    <p className="pt-2 text-xs">
                      *Suporte técnico 24/7 para plano Clínicas
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contato;
