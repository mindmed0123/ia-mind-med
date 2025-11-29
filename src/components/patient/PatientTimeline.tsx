import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, Image as ImageIcon, Pill, Calendar, 
  ChevronDown, ChevronUp, Loader2, TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface TimelineItem {
  id: string;
  type: 'laudo' | 'prescription' | 'document';
  title: string;
  date: string;
  description?: string;
  category?: string;
  thumbnail?: string;
  data?: any;
}

interface PatientTimelineProps {
  patientId: string;
}

export function PatientTimeline({ patientId }: PatientTimelineProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadTimeline();
  }, [patientId, user]);

  const loadTimeline = async () => {
    if (!user) return;

    try {
      // Load all data in parallel
      const [laudosRes, prescriptionsRes, documentsRes] = await Promise.all([
        supabase
          .from('laudos')
          .select('*')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false }),
        supabase
          .from('prescriptions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('patient_documents')
          .select('*')
          .eq('patient_id', patientId)
          .order('uploaded_at', { ascending: false }),
      ]);

      const timelineItems: TimelineItem[] = [];

      // Add laudos
      (laudosRes.data || []).forEach((laudo: any) => {
        timelineItems.push({
          id: laudo.id,
          type: 'laudo',
          title: laudo.title || 'Laudo Médico',
          date: laudo.created_at,
          description: laudo.diagnosis_main || laudo.specialty,
          data: laudo,
        });
      });

      // Add prescriptions
      (prescriptionsRes.data || []).forEach((prescription: any) => {
        timelineItems.push({
          id: prescription.id,
          type: 'prescription',
          title: 'Receituário',
          date: prescription.created_at,
          description: `${(prescription.items as any[])?.length || 0} medicamento(s)`,
          data: prescription,
        });
      });

      // Add documents
      (documentsRes.data || []).forEach((doc: any) => {
        timelineItems.push({
          id: doc.id,
          type: 'document',
          title: doc.file_name,
          date: doc.uploaded_at,
          description: doc.ai_description || doc.category,
          category: doc.category,
          thumbnail: doc.file_type === 'image' ? doc.file_url : undefined,
          data: doc,
        });
      });

      // Sort by date
      timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setItems(timelineItems);
    } catch (error) {
      console.error('Error loading timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'laudo': return <FileText className="h-4 w-4" />;
      case 'prescription': return <Pill className="h-4 w-4" />;
      case 'document': return <ImageIcon className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'laudo': return 'Laudo';
      case 'prescription': return 'Receita';
      case 'document': return 'Documento';
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'laudo': return 'bg-blue-500';
      case 'prescription': return 'bg-green-500';
      case 'document': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const displayedItems = showAll ? items : items.slice(0, 10);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="py-12">
        <div className="text-center text-muted-foreground">
          <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum histórico encontrado</p>
          <p className="text-sm">Laudos, receitas e documentos aparecerão aqui</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Linha do Tempo
        </h3>
        <Badge variant="outline">{items.length} registro(s)</Badge>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

        <div className="space-y-4">
          {displayedItems.map((item, index) => (
            <div key={item.id} className="relative pl-10">
              {/* Timeline dot */}
              <div className={`absolute left-2 w-5 h-5 rounded-full ${getTypeColor(item.type)} flex items-center justify-center`}>
                <div className="text-white">
                  {getIcon(item.type)}
                </div>
              </div>

              <Card 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => toggleExpand(item.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs">
                          {getTypeLabel(item.type)}
                        </Badge>
                        {item.category && (
                          <Badge variant="outline" className="text-xs">
                            {item.category}
                          </Badge>
                        )}
                      </div>
                      
                      <h4 className="font-medium">{item.title}</h4>
                      
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(item.date), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })}
                      </div>

                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {item.thumbnail && (
                        <img 
                          src={item.thumbnail} 
                          alt=""
                          className="w-16 h-16 object-cover rounded"
                        />
                      )}
                      {expandedItems.has(item.id) ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded content */}
                  {expandedItems.has(item.id) && (
                    <div className="mt-4 pt-4 border-t">
                      {item.type === 'laudo' && item.data && (
                        <div className="space-y-2">
                          {item.data.diagnosis_main && (
                            <div>
                              <span className="text-sm font-medium">Diagnóstico:</span>
                              <p className="text-sm text-muted-foreground">{item.data.diagnosis_main}</p>
                            </div>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/laudo/${item.data.id}`);
                            }}
                          >
                            Ver Laudo Completo
                          </Button>
                        </div>
                      )}

                      {item.type === 'prescription' && item.data && (
                        <div className="space-y-2">
                          <span className="text-sm font-medium">Medicamentos:</span>
                          <ul className="text-sm text-muted-foreground list-disc list-inside">
                            {(item.data.items as any[])?.slice(0, 3).map((med: any, idx: number) => (
                              <li key={idx}>{med.name || med.medication}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {item.type === 'document' && item.data && (
                        <div className="space-y-2">
                          {item.data.ai_description && (
                            <div>
                              <span className="text-sm font-medium">Análise IA:</span>
                              <p className="text-sm text-muted-foreground">{item.data.ai_description}</p>
                            </div>
                          )}
                          {item.data.notes && (
                            <div>
                              <span className="text-sm font-medium">Anotações:</span>
                              <p className="text-sm text-muted-foreground">{item.data.notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {items.length > 10 && (
        <div className="text-center">
          <Button 
            variant="outline" 
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Mostrar menos' : `Ver todos (${items.length})`}
          </Button>
        </div>
      )}
    </div>
  );
}
