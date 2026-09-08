-- Preserve every saved payload/copy; stop only unfinished jobs from the retired model.
UPDATE weekly_planning_runs
SET status='failed', lease_token=NULL, lease_until=NULL,
    error='ეს ძველი დაგეგმვის მოდელის დაუმთავრებელი ჩანაწერია. დაადასტურეთ სოციალური სტრატეგია და შექმენით კვირის ახალი ვერსია.',
    updated_at=now()
WHERE NOT(payload ? 'socialStrategy') AND status IN ('queued','running');

UPDATE weekly_post_batches p
SET status='failed', lease_token=NULL, lease_until=NULL,
    error='შენახული ტექსტები შენარჩუნებულია. გაგრძელებისთვის საჭიროა ახალი სოციალური სტრატეგიის შესაბამისი გეგმა.',
    updated_at=now()
FROM weekly_planning_runs r
WHERE r.id=p.run_id AND NOT(r.payload ? 'socialStrategy') AND p.status IN ('queued','running');
