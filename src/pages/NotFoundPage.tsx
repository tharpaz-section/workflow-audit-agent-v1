import { ButtonLink } from '@/components/ui/Button';
import { PageLayout } from '@/components/ui/PageLayout';

export function NotFoundPage() {
  return (
    <PageLayout
      eyebrow="Workflow Audit Agent"
      title="That page does not exist"
      subtitle="Jump back into the audit flow or open the admin view."
    >
      <div className="button-row">
        <ButtonLink to="/">Back to start</ButtonLink>
        <ButtonLink to="/admin" variant="secondary">
          Admin dashboard
        </ButtonLink>
      </div>
    </PageLayout>
  );
}
