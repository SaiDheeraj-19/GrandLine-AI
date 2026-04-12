import React from 'react';
import { MapPin, Phone, Star, Briefcase } from 'lucide-react';

const SKILL_COLORS = {
  medical:   'bg-red-500/10 text-red-400 border-red-500/20',
  food:      'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  logistics: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  rescue:    'bg-orange-500/10 text-orange-400 border-orange-500/20',
  general:   'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const STATUS_COLORS = {
  available:   'bg-green-500/10 text-green-400 border-green-500/20',
  deployed:    'bg-orange-500/10 text-orange-400 border-orange-500/20',
  unavailable: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
};

export default function VolunteerCard({ volunteer }) {
  const { id, name, phone, location, skills, status, deployments_count } = volunteer;

  return (
    <div id={`volunteer-card-${id}`} className="card border border-border">
      <div className="flex items-start justify-between">
        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
            {name.charAt(0)}
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-panel ${
                status === 'available' ? 'bg-green-400' :
                status === 'deployed'  ? 'bg-orange-400' : 'bg-slate-500'
              }`}
            />
          </div>
          <div>
            <p className="font-semibold text-white text-sm">{name}</p>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <MapPin size={11} />
              {location?.area_name || 'Visakhapatnam'}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[status] || STATUS_COLORS.unavailable}`}>
          {status}
        </span>
      </div>

      {/* Skills */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {skills?.map(skill => (
          <span key={skill} className={`text-xs px-2 py-0.5 rounded-full border ${SKILL_COLORS[skill] || SKILL_COLORS.general}`}>
            {skill}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Briefcase size={11} />
          {deployments_count || 0} deployments
        </span>
        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Phone size={11} />
            {phone}
          </a>
        )}
      </div>
    </div>
  );
}
