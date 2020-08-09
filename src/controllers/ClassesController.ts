import { Request, Response} from 'express';

import db from '../database/connection';
import convertHourToMinutes from '../utils/convertHourToMinutes';

interface ScheduleItem {
    week_day: number,
    from: string,
    to: string
}

export default class ClassesController {
    async index(request: Request, response: Response) {
        const filters = request.query;

        const week_day = filters.week_day as string;
        const subject = filters.subject as string;
        const time = filters.time as string;

        const classes = db('classes')
            .join('users', 'classes.user_id', '=', 'users.id')
            .join('class_schedule', 'classes.id', '=', 'class_schedule.class_id')
            .select(['classes.*', 'users.*'])
            .limit(20);

            subject 
                ? classes.where('classes.subject', '=', subject)
                : false;
            week_day 
                ? classes.where('class_schedule.week_day', '=', [Number(week_day)]) 
                : false;
            if (time) {
                const timeInMinutes = convertHourToMinutes(time);
                classes.where('class_schedule.from', '=', [Number(timeInMinutes)])
                    .where('class_schedule.to', '=', [Number(timeInMinutes)]) 
            }
                        
        return response.json(await classes);
    }

    async create(request: Request, response: Response) {
        const {
            name,
            avatar,
            whatsapp,
            bio,
            subject,
            cost,
            schedule
        } = request.body;

        const trx = await db.transaction();

        try {
            const insertedUsersIds = await trx('users').insert({
                name,
                avatar,
                whatsapp,
                bio,
            });

            const user_id = insertedUsersIds[0];

            const insertedClassesIds = await trx('classes').insert({
                subject,
                cost,
                user_id,
            });

            const class_id = insertedClassesIds[0];

            const classSchedule = schedule.map((scheduleItem: ScheduleItem) => {
                return {
                    class_id,
                    week_day: scheduleItem.week_day,
                    from: convertHourToMinutes(scheduleItem.from),
                    to: convertHourToMinutes(scheduleItem.to),
                }
            })

            await trx('class_schedule').insert(classSchedule)

            await trx.commit();

            return response.status(201).send();
        } catch (err) {
            await trx.rollback();

            return response.status(400).json({
                error: 'Unexpected error while creating new class'
            })
        }
    }
}